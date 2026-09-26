import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod"
import { z } from "zod"

// Shared plumbing for every /api/agents/* route. Each route used to
// repeat the API-key check, client construction, model constant and
// error handling — and none of them checked *who* was calling, even
// though every call spends real money on ANTHROPIC_API_KEY. Centralizing
// it means the auth, size and rate guards can't be forgotten on one route.
export const MODEL = "claude-sonnet-5"

const MAX_BODY_BYTES = 256 * 1024
// Best-effort abuse brake, not a hard quota: this Map lives in one server
// instance's memory, so on a multi-instance deployment each instance
// counts separately. It still stops a single signed-in account from
// hammering the paid API in a loop.
const RATE_LIMIT_MAX_REQUESTS = 20
const RATE_LIMIT_WINDOW_MS = 60_000
const recentRequests = new Map<string, number[]>()

export class AgentHttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

// Verifies a Firebase ID token via Identity Toolkit's accounts:lookup —
// Google's own verifier, using the same public web API key the client
// already ships, so no service-account secret is needed. It also rejects
// tokens for deleted/disabled users, which local JWT checks would not.
async function verifyIdToken(idToken: string): Promise<string | null> {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  if (!apiKey) return null
  try {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { users?: { localId?: string }[] }
    return data.users?.[0]?.localId ?? null
  } catch {
    return null
  }
}

function isRateLimited(key: string, now = Date.now()): boolean {
  const recent = (recentRequests.get(key) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS)
  if (recent.length >= RATE_LIMIT_MAX_REQUESTS) {
    recentRequests.set(key, recent)
    return true
  }
  recent.push(now)
  recentRequests.set(key, recent)
  // Keep the Map from growing without bound across many distinct users.
  if (recentRequests.size > 5000) {
    for (const [k, times] of recentRequests) {
      if (times.every((t) => now - t >= RATE_LIMIT_WINDOW_MS)) recentRequests.delete(k)
    }
  }
  return false
}

// Sign-in check + per-user rate limit for any route that spends a paid or
// quota-limited server-side key. `bucket` keeps unrelated routes from
// eating each other's request budget (agents vs. the Adzuna proxy).
export async function requireUser(request: NextRequest, bucket: string): Promise<string> {
  const header = request.headers.get("authorization") ?? ""
  const idToken = header.startsWith("Bearer ") ? header.slice(7).trim() : ""
  const uid = idToken ? await verifyIdToken(idToken) : null
  if (!uid) throw new AgentHttpError(401, "Sign in required.")
  if (isRateLimited(`${bucket}:${uid}`)) {
    throw new AgentHttpError(429, "Too many requests — try again in a minute.")
  }
  return uid
}

// Exported for routes that need signed-in-user + validated-JSON-body
// handling but aren't LLM-backed (so agentRoute's Anthropic-client
// requirement doesn't apply) — the notification routes, e.g.
export async function readValidatedBody<S extends z.ZodType>(request: NextRequest, schema: S): Promise<z.infer<S>> {
  const declaredLength = Number(request.headers.get("content-length") ?? 0)
  if (declaredLength > MAX_BODY_BYTES) throw new AgentHttpError(413, "Request body too large.")
  const text = await request.text()
  if (text.length > MAX_BODY_BYTES) throw new AgentHttpError(413, "Request body too large.")

  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw new AgentHttpError(400, "Request body must be valid JSON.")
  }
  const parsed = schema.safeParse(json)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const where = issue.path.length > 0 ? ` at "${issue.path.join(".")}"` : ""
    throw new AgentHttpError(400, `Invalid request${where}: ${issue.message}`)
  }
  return parsed.data
}

type AgentContext<S extends z.ZodType> = { client: Anthropic; body: z.infer<S>; uid: string }

// Wraps a handler with: sign-in check → rate limit → body size/JSON/schema
// validation → API-key check → uniform error handling. The handler's
// return value is sent as JSON.
export function agentRoute<S extends z.ZodType>(
  options: { name: string; schema: S },
  handler: (ctx: AgentContext<S>) => Promise<object>,
) {
  return async function POST(request: NextRequest): Promise<NextResponse> {
    try {
      const uid = await requireUser(request, "agents")

      const body = await readValidatedBody(request, options.schema)

      const apiKey = process.env.ANTHROPIC_API_KEY
      if (!apiKey) throw new AgentHttpError(500, "ANTHROPIC_API_KEY is not configured on the server.")

      const result = await handler({ client: new Anthropic({ apiKey }), body, uid })
      return NextResponse.json(result)
    } catch (err) {
      if (err instanceof AgentHttpError) {
        return NextResponse.json({ error: err.message }, { status: err.status })
      }
      // Upstream/SDK error text can include request details — log it,
      // but don't hand it back to the browser.
      console.error(`[agents] ${options.name} failed:`, err)
      return NextResponse.json({ error: `${options.name} failed. Please try again.` }, { status: 502 })
    }
  }
}

// One structured-output call. Returns null when the model's output
// couldn't be parsed, so each caller can supply its own honest fallback.
export async function parseStructured<S extends z.ZodType>(
  client: Anthropic,
  args: { system: string; prompt: string; maxTokens: number; schema: S },
): Promise<z.infer<S> | null> {
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: args.maxTokens,
    system: args.system,
    messages: [{ role: "user", content: args.prompt }],
    output_config: { format: zodOutputFormat(args.schema) },
  })
  return (response.parsed_output as z.infer<S> | null | undefined) ?? null
}

const MessageSchema = z.object({ message: z.string() })

// The common case: one short in-character note.
export async function narrate(
  client: Anthropic,
  args: { system: string; prompt: string; maxTokens: number },
): Promise<string | null> {
  const parsed = await parseStructured(client, { ...args, schema: MessageSchema })
  return parsed?.message ?? null
}

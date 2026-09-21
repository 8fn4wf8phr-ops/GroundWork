import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod"
import { z } from "zod"

const MODEL = "claude-sonnet-5"

const LogSchema = z.object({ message: z.string() })

const LEDGER_SYSTEM = `You are Ledger, the tracking agent for Groundwork, a personal job-search assistant. Your personality: meticulous to a fault, dry sense of humor about it.

You log status changes to a shared case file — a real note a teammate would read, not a system log line. One short sentence. Reference only the facts you're given (company, title, old status, new status) — never invent context about why it changed.`

type LogInput = { company: string; title: string; oldStatus: string; newStatus: string }

function buildPrompt(input: LogInput): string {
  return `Application status changed: "${input.title}" at ${input.company} moved from "${input.oldStatus}" to "${input.newStatus}". Log it.`
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured on the server." }, { status: 500 })
  }
  const body = (await request.json()) as LogInput
  const client = new Anthropic({ apiKey })

  try {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 200,
      system: LEDGER_SYSTEM,
      messages: [{ role: "user", content: buildPrompt(body) }],
      output_config: { format: zodOutputFormat(LogSchema) },
    })
    const message = response.parsed_output?.message ?? `${body.title} at ${body.company}: ${body.oldStatus} → ${body.newStatus}.`
    return NextResponse.json({ message })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: `Ledger log failed: ${message}` }, { status: 502 })
  }
}

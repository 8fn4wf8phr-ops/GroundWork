import { NextRequest, NextResponse } from "next/server"
import { AgentHttpError, requireUser } from "@/lib/server/agent-route"
import { AdzunaConfigError, callAdzuna } from "@/lib/server/adzuna-api"

// Server-side proxy for Adzuna's search API. ADZUNA_APP_KEY is a real
// secret tied to the account's rate quota — deliberately not prefixed
// with NEXT_PUBLIC_, so it never reaches the browser bundle. The client
// calls this route instead of api.adzuna.com directly (see
// lib/discovery/adzuna.ts). Because the key's quota is the thing being
// protected, the route also requires a signed-in user and rate-limits
// them — otherwise anyone with the URL could spend it.
const MAX_QUERY_LENGTH = 200

export async function GET(request: NextRequest) {
  try {
    await requireUser(request, "adzuna")
  } catch (err) {
    if (err instanceof AgentHttpError) return NextResponse.json({ error: err.message }, { status: err.status })
    throw err
  }

  const what = request.nextUrl.searchParams.get("what") ?? ""
  const where = request.nextUrl.searchParams.get("where") ?? ""
  if (what.length > MAX_QUERY_LENGTH || where.length > MAX_QUERY_LENGTH) {
    return NextResponse.json({ error: "Search terms are too long." }, { status: 400 })
  }

  try {
    return NextResponse.json(await callAdzuna(what, where))
  } catch (err) {
    if (err instanceof AdzunaConfigError) return NextResponse.json({ error: err.message }, { status: 500 })
    return NextResponse.json({ error: err instanceof Error ? err.message : "Adzuna request failed" }, { status: 502 })
  }
}

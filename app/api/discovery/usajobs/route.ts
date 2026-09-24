import { NextRequest, NextResponse } from "next/server"
import { AgentHttpError, requireUser } from "@/lib/server/agent-route"
import { UsajobsConfigError, callUsajobs } from "@/lib/server/usajobs-api"

// Server-side proxy for the USAJobs search API. USAJOBS_API_KEY is tied
// to the registrant's identity — deliberately not prefixed with
// NEXT_PUBLIC_, so it never reaches the browser bundle. USAJobs also
// sends no CORS header (confirmed live), so a browser couldn't call it
// directly even without the key concern. Same requireUser + rate-limit
// treatment as the Adzuna proxy, with its own bucket.
const MAX_KEYWORD_LENGTH = 200

export async function GET(request: NextRequest) {
  try {
    await requireUser(request, "usajobs")
  } catch (err) {
    if (err instanceof AgentHttpError) return NextResponse.json({ error: err.message }, { status: err.status })
    throw err
  }

  const keyword = request.nextUrl.searchParams.get("keyword") ?? ""
  const remoteOnly = request.nextUrl.searchParams.get("remoteOnly") === "true"
  if (keyword.length > MAX_KEYWORD_LENGTH) {
    return NextResponse.json({ error: "Search terms are too long." }, { status: 400 })
  }

  try {
    return NextResponse.json(await callUsajobs(keyword, remoteOnly))
  } catch (err) {
    if (err instanceof UsajobsConfigError) return NextResponse.json({ error: err.message }, { status: 500 })
    return NextResponse.json({ error: err instanceof Error ? err.message : "USAJobs request failed" }, { status: 502 })
  }
}

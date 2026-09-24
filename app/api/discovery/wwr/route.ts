import { NextRequest, NextResponse } from "next/server"
import { AgentHttpError, requireUser } from "@/lib/server/agent-route"
import { callWwr } from "@/lib/server/wwr-api"

// Server-side proxy for We Work Remotely's RSS feed. No key to protect
// here (the feed is public, unauthenticated), but it sends no CORS header
// (confirmed live), so a browser fetch to weworkremotely.com directly
// would be blocked. requireUser still applies so this doesn't become an
// open, unauthenticated way to scrape WWR through our domain.
export async function GET(request: NextRequest) {
  try {
    await requireUser(request, "wwr")
  } catch (err) {
    if (err instanceof AgentHttpError) return NextResponse.json({ error: err.message }, { status: err.status })
    throw err
  }

  try {
    const xml = await callWwr()
    return new NextResponse(xml, { headers: { "content-type": "application/rss+xml; charset=utf-8" } })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "We Work Remotely request failed" }, { status: 502 })
  }
}

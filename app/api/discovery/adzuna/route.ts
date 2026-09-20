import { NextRequest, NextResponse } from "next/server"

// Server-side proxy for Adzuna's search API. ADZUNA_APP_KEY is a real
// secret tied to the account's rate quota — deliberately not prefixed
// with NEXT_PUBLIC_, so it never reaches the browser bundle. The client
// calls this route instead of api.adzuna.com directly (see
// lib/discovery/adzuna.ts).
const ADZUNA_APP_ID = process.env.ADZUNA_APP_ID
const ADZUNA_APP_KEY = process.env.ADZUNA_APP_KEY
const ADZUNA_COUNTRY = process.env.ADZUNA_COUNTRY || "us"

export async function GET(request: NextRequest) {
  if (!ADZUNA_APP_ID || !ADZUNA_APP_KEY) {
    return NextResponse.json(
      { error: "Adzuna credentials are not configured (ADZUNA_APP_ID / ADZUNA_APP_KEY)." },
      { status: 500 },
    )
  }

  const what = request.nextUrl.searchParams.get("what") ?? ""
  const where = request.nextUrl.searchParams.get("where") ?? ""

  const url = new URL(`https://api.adzuna.com/v1/api/jobs/${ADZUNA_COUNTRY}/search/1`)
  url.searchParams.set("app_id", ADZUNA_APP_ID)
  url.searchParams.set("app_key", ADZUNA_APP_KEY)
  url.searchParams.set("results_per_page", "50")
  url.searchParams.set("content-type", "application/json")
  if (what) url.searchParams.set("what", what)
  if (where) url.searchParams.set("where", where)

  const res = await fetch(url.toString())
  if (!res.ok) {
    return NextResponse.json({ error: `Adzuna API returned ${res.status}` }, { status: 502 })
  }

  const body = await res.json()
  return NextResponse.json(body)
}

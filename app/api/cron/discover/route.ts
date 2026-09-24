import { createHash, timingSafeEqual } from "node:crypto"
import Anthropic from "@anthropic-ai/sdk"
import { NextRequest, NextResponse } from "next/server"
import { fetchAdzunaJobsForProfile } from "@/lib/discovery/adzuna-map"
import { fetchArbeitnowJobs } from "@/lib/discovery/arbeitnow"
import { fetchRemoteOkJobs } from "@/lib/discovery/remoteok"
import { fetchJobicyJobsForProfile } from "@/lib/discovery/jobicy"
import { fetchThemuseJobs } from "@/lib/discovery/themuse"
import { fetchUsajobsForProfile } from "@/lib/discovery/usajobs-map"
import { callUsajobs } from "@/lib/server/usajobs-api"
import { fetchWeWorkRemotelyJobs } from "@/lib/discovery/wwr-map"
import { callWwr } from "@/lib/server/wwr-api"
import { AdminConfigError, getAdminDb } from "@/lib/server/firebase-admin"
import { callAdzuna } from "@/lib/server/adzuna-api"
import { createAdminStore } from "@/lib/server/admin-store"
import { reviewJobs } from "@/lib/server/review-jobs"
import { runScheduledDiscovery } from "@/lib/server/scheduled-discovery"

// Vercel Cron target (see vercel.json). Vercel calls it with
// `Authorization: Bearer $CRON_SECRET`; anything else is refused, and an
// unset CRON_SECRET refuses everything — this route must never be open,
// because it uses Admin access and spends the Anthropic key.
export const maxDuration = 60

function secretMatches(header: string, secret: string): boolean {
  // Hash both sides so the comparison is constant-time and length-safe.
  const a = createHash("sha256").update(header).digest()
  const b = createHash("sha256").update(`Bearer ${secret}`).digest()
  return timingSafeEqual(a, b)
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 })
  if (!secretMatches(request.headers.get("authorization") ?? "", secret)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  let db
  try {
    db = getAdminDb()
  } catch (err) {
    if (err instanceof AdminConfigError) return NextResponse.json({ error: err.message }, { status: 503 })
    throw err
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  const client = apiKey ? new Anthropic({ apiKey }) : null

  try {
    const result = await runScheduledDiscovery(
      {
        store: createAdminStore(db),
        fetchers: {
          adzuna: (profile) => fetchAdzunaJobsForProfile(profile, callAdzuna),
          arbeitnow: () => fetchArbeitnowJobs(),
          remoteok: () => fetchRemoteOkJobs(),
          jobicy: (profile) => fetchJobicyJobsForProfile(profile),
          themuse: (profile) => fetchThemuseJobs(profile),
          usajobs: (profile) => fetchUsajobsForProfile(profile, callUsajobs),
          weworkremotely: () => fetchWeWorkRemotelyJobs(callWwr),
        },
        reviewer: client ? (jobs, profile) => reviewJobs(client, jobs, profile) : null,
        now: new Date(),
      },
      // ?force=1 skips the once-per-20h guard, for manual testing only.
      { force: request.nextUrl.searchParams.get("force") === "1" },
    )
    return NextResponse.json(result)
  } catch (err) {
    console.error("[cron] scheduled discovery failed:", err)
    return NextResponse.json({ error: "Scheduled discovery failed." }, { status: 500 })
  }
}

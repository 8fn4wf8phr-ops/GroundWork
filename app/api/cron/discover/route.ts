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
import { sendEmail } from "@/lib/email"
import { buildNewMatchEmail } from "@/lib/email/templates"
import { secretMatches } from "@/lib/server/cron-auth"

// Vercel Cron target (see vercel.json). Vercel calls it with
// `Authorization: Bearer $CRON_SECRET`; anything else is refused, and an
// unset CRON_SECRET refuses everything — this route must never be open,
// because it uses Admin access and spends the Anthropic key.
export const maxDuration = 60

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
  const emailingEnabled = Boolean(process.env.RESEND_API_KEY)

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
        emailer: emailingEnabled
          ? async (to, jobs) => {
              const email = buildNewMatchEmail(
                jobs.map((j) => ({
                  title: j.title,
                  company: j.company,
                  location: j.location,
                  matchScore: j.matchScore ?? 0,
                  matchReasons: j.matchReasons ?? [],
                  postingUrl: j.postingUrl,
                })),
              )
              if (email) await sendEmail({ to, subject: email.subject, text: email.text })
            }
          : null,
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

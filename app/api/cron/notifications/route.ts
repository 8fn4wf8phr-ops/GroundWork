import { NextRequest, NextResponse } from "next/server"
import { secretMatches } from "@/lib/server/cron-auth"
import { AdminConfigError, getAdminDb } from "@/lib/server/firebase-admin"
import { getApplicationsWithJobs, listUsersWithNotificationEmail } from "@/lib/server/notification-data"
import { dueToday, upcomingWithinDays } from "@/lib/notifications/follow-ups"
import { computeOverallStats, computeRatesByChannel, computeRatesBySource } from "@/lib/analytics"
import { detectNotablePattern } from "@/lib/agents/pattern-signals"
import { buildFollowUpReminderEmail, buildWeeklyDigestEmail } from "@/lib/email/templates"
import { sendEmail } from "@/lib/email"

// Vercel Cron target (see vercel.json), same fail-closed CRON_SECRET
// treatment as app/api/cron/discover. Runs the daily follow-up reminder
// every day, and also the weekly digest on Mondays — one route instead of
// two separate cron entries, to keep this project at 2 total Vercel Cron
// jobs rather than 3 (this one + discovery); Vercel's cron-count limits
// vary by plan, and the user only asked for "runs daily" / "runs weekly"
// behavior, not for a specific number of vercel.json entries, so
// consolidating costs nothing user-visible.
export const maxDuration = 60

function statusCounts(applications: { status: string }[]) {
  const counts = new Map<string, number>()
  for (const a of applications) counts.set(a.status, (counts.get(a.status) ?? 0) + 1)
  return [...counts.entries()].map(([status, count]) => ({ status, count }))
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 })
  if (!secretMatches(request.headers.get("authorization") ?? "", secret)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: "RESEND_API_KEY is not configured." }, { status: 503 })
  }

  let db
  try {
    db = getAdminDb()
  } catch (err) {
    if (err instanceof AdminConfigError) return NextResponse.json({ error: err.message }, { status: 503 })
    throw err
  }

  // ?force=1 also runs the weekly digest regardless of day, for manual
  // testing — same convention as the discovery cron's own ?force=1.
  const force = request.nextUrl.searchParams.get("force") === "1"
  const runWeeklyDigest = force || new Date().getUTCDay() === 1 // Monday
  const today = new Date().toISOString().slice(0, 10)

  const users = await listUsersWithNotificationEmail(db)
  const results: { user: string; followUpSent: boolean; digestSent: boolean; error?: string }[] = []

  for (const user of users) {
    const entry = { user: user.uid.slice(0, 6), followUpSent: false, digestSent: false }
    try {
      const applications = await getApplicationsWithJobs(db, user.uid)

      const followUpEmail = buildFollowUpReminderEmail(dueToday(applications, today))
      if (followUpEmail) {
        await sendEmail({ to: user.notificationEmail, subject: followUpEmail.subject, text: followUpEmail.text })
        entry.followUpSent = true
      }

      if (runWeeklyDigest) {
        const digestEmail = buildWeeklyDigestEmail({
          statusCounts: statusCounts(applications),
          overall: computeOverallStats(applications),
          upcomingFollowUps: upcomingWithinDays(applications, today, 7),
          pattern: detectNotablePattern(computeRatesByChannel(applications), computeRatesBySource(applications)),
        })
        await sendEmail({ to: user.notificationEmail, subject: digestEmail.subject, text: digestEmail.text })
        entry.digestSent = true
      }
      results.push(entry)
    } catch (err) {
      results.push({ ...entry, error: err instanceof Error ? err.message : String(err) })
    }
  }

  return NextResponse.json({ ranWeeklyDigest: runWeeklyDigest, users: results })
}

import { z } from "zod"
import { NextRequest, NextResponse } from "next/server"
import { AgentHttpError, readValidatedBody, requireUser } from "@/lib/server/agent-route"
import { EmailConfigError, sendEmail } from "@/lib/email"
import { buildFollowUpReminderEmail, buildNewMatchEmail, buildWeeklyDigestEmail } from "@/lib/email/templates"

// Manual test-send for the three email types that normally only fire from
// a cron or a qualifying discovery pull (Requirements: "a way to manually
// trigger each email type for testing... before waiting on a real cron
// trigger"). Tailored-materials confirmation isn't here — it sends on
// every real "Generate tailored materials" call
// (app/api/agents/tailor/route.ts), so using that feature already is the
// test. Deliberately sends real content from the signed-in user's own
// real data (gathered client-side from the same hooks the real UI uses),
// not fabricated placeholder text — if there's nothing to show, the
// response says so rather than sending a misleading email.
const short = z.string().max(300)

const FollowUpTest = z.object({
  type: z.literal("follow-up"),
  notificationEmail: z.string().email().max(320),
  applications: z.array(z.object({ title: short, company: short, status: short })).max(200),
})

const NewMatchTest = z.object({
  type: z.literal("new-match"),
  notificationEmail: z.string().email().max(320),
  jobs: z
    .array(
      z.object({
        title: short,
        company: short,
        location: short,
        matchScore: z.number().min(0).max(100),
        matchReasons: z.array(short).max(20),
        postingUrl: z.string().max(1000).optional(),
      }),
    )
    .max(200),
})

const WeeklyDigestTest = z.object({
  type: z.literal("weekly-digest"),
  notificationEmail: z.string().email().max(320),
  statusCounts: z.array(z.object({ status: short, count: z.number().int().min(0) })).max(20),
  overall: z.object({
    totalApplications: z.number().int().min(0),
    responseRate: z.number(),
    interviewRate: z.number(),
    offerRate: z.number(),
  }),
  upcomingFollowUps: z.array(z.object({ title: short, company: short, followUpDate: short })).max(50),
  pattern: z
    .object({
      dimension: z.enum(["channel", "source"]),
      leaderLabel: short,
      leaderRate: z.number(),
      leaderSampleSize: z.number().int(),
      laggardLabel: short,
      laggardRate: z.number(),
      laggardSampleSize: z.number().int(),
      lowConfidence: z.boolean(),
    })
    .nullable(),
})

const RequestSchema = z.discriminatedUnion("type", [FollowUpTest, NewMatchTest, WeeklyDigestTest])

export async function POST(request: NextRequest) {
  try {
    await requireUser(request, "notifications")
    const body = await readValidatedBody(request, RequestSchema)

    const email =
      body.type === "follow-up"
        ? buildFollowUpReminderEmail(body.applications)
        : body.type === "new-match"
          ? buildNewMatchEmail(body.jobs)
          : buildWeeklyDigestEmail(body)

    if (!email) {
      const reason =
        body.type === "follow-up" ? "No applications have a follow-up date set." : "No jobs are currently scoring above 70."
      return NextResponse.json({ sent: false, reason })
    }

    await sendEmail({ to: body.notificationEmail, subject: email.subject, text: email.text })
    return NextResponse.json({ sent: true })
  } catch (err) {
    if (err instanceof AgentHttpError) return NextResponse.json({ error: err.message }, { status: err.status })
    if (err instanceof EmailConfigError) return NextResponse.json({ error: err.message }, { status: 503 })
    console.error("[notifications] test send failed:", err)
    return NextResponse.json({ error: "Couldn't send the test email." }, { status: 502 })
  }
}

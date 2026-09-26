import { z } from "zod"
import { NextRequest, NextResponse } from "next/server"
import { AgentHttpError, readValidatedBody, requireUser } from "@/lib/server/agent-route"
import { EmailConfigError, sendEmail } from "@/lib/email"
import { buildNewMatchEmail } from "@/lib/email/templates"

// Called from the browser right after a manual "Pull new postings" saves
// new Jobs (components/review-queue/review-queue-view.tsx) — the
// scheduled-discovery cron sends this same email itself, server-side,
// since it already has Resend access there (see lib/server/scheduled-discovery.ts).
// Not LLM-backed, so this uses requireUser directly rather than
// agentRoute, which would require ANTHROPIC_API_KEY unnecessarily.
const short = z.string().max(300)
const RequestSchema = z.object({
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
    .max(50),
})

export async function POST(request: NextRequest) {
  try {
    await requireUser(request, "notifications")
    const body = await readValidatedBody(request, RequestSchema)

    const email = buildNewMatchEmail(body.jobs)
    if (!email) return NextResponse.json({ sent: false })

    await sendEmail({ to: body.notificationEmail, subject: email.subject, text: email.text })
    return NextResponse.json({ sent: true })
  } catch (err) {
    if (err instanceof AgentHttpError) return NextResponse.json({ error: err.message }, { status: err.status })
    if (err instanceof EmailConfigError) return NextResponse.json({ error: err.message }, { status: 503 })
    console.error("[notifications] new-matches failed:", err)
    return NextResponse.json({ error: "Couldn't send the notification email." }, { status: 502 })
  }
}

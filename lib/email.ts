import { Resend } from "resend"

// Every email notification (follow-up reminders, new matches, the weekly
// digest, tailored-materials copies) goes through this one function, so
// there's exactly one place that reads RESEND_API_KEY and knows how to
// talk to Resend. RESEND_API_KEY is server-only (never NEXT_PUBLIC_) —
// same reasoning as every other paid third-party key in this project.
export class EmailConfigError extends Error {}

// Resend's own shared sending domain — works out of the box with no
// custom domain verified, which is what a fresh Resend signup starts
// with. EMAIL_FROM overrides it once a real domain is verified, per the
// "configurable from address" requirement — nothing in this file hardcodes
// a specific domain.
const DEFAULT_FROM = "Groundwork <onboarding@resend.dev>"

export async function sendEmail(args: { to: string; subject: string; text: string }): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new EmailConfigError("RESEND_API_KEY is not configured.")

  const resend = new Resend(apiKey)
  const result = await resend.emails.send({
    from: process.env.EMAIL_FROM || DEFAULT_FROM,
    to: args.to,
    subject: args.subject,
    text: args.text,
  })
  if (result.error) throw new Error(`Resend error: ${result.error.message}`)
}

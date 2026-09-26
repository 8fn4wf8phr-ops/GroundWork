"use client"

import { useState } from "react"
import { colors } from "@/lib/theme"
import { useApplications } from "@/lib/hooks/use-applications"
import { useReviewQueue } from "@/lib/hooks/use-review-queue"
import { computeOverallStats, computeRatesByChannel, computeRatesBySource } from "@/lib/analytics"
import { detectNotablePattern } from "@/lib/agents/pattern-signals"
import { dueToday, upcomingWithinDays } from "@/lib/notifications/follow-ups"
import { postAgent } from "@/lib/agents/client"

// Manual test-send for the three email types that don't naturally fire on
// demand (Requirements: check formatting before waiting on a real cron).
// Every button sends real content built from the signed-in user's own
// real, currently-loaded data — never placeholder text — so a successful
// send here is a genuine preview of what the real cron/pull would send.
type TestType = "follow-up" | "new-match" | "weekly-digest"

const TODAY = () => new Date().toISOString().slice(0, 10)

export default function NotificationTestPanel({ notificationEmail }: { notificationEmail?: string }) {
  const { applications } = useApplications()
  const { pending } = useReviewQueue()
  const [sending, setSending] = useState<TestType | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const send = async (type: TestType) => {
    if (!notificationEmail) {
      setMessage("Set a notification email above and save your profile first.")
      return
    }
    setSending(type)
    setMessage(null)
    try {
      let body: Record<string, unknown>
      if (type === "follow-up") {
        body = { type, notificationEmail, applications: dueToday(applications, TODAY()) }
      } else if (type === "new-match") {
        body = {
          type,
          notificationEmail,
          jobs: pending.map((j) => ({
            title: j.title,
            company: j.company,
            location: j.location,
            matchScore: j.matchScore ?? 0,
            matchReasons: j.matchReasons ?? [],
            postingUrl: j.postingUrl,
          })),
        }
      } else {
        const byChannel = computeRatesByChannel(applications)
        const bySource = computeRatesBySource(applications)
        const overall = computeOverallStats(applications)
        const statusCounts = Object.entries(
          applications.reduce<Record<string, number>>((acc, a) => {
            acc[a.status] = (acc[a.status] ?? 0) + 1
            return acc
          }, {}),
        ).map(([status, count]) => ({ status, count }))
        body = {
          type,
          notificationEmail,
          statusCounts,
          overall,
          upcomingFollowUps: upcomingWithinDays(applications, TODAY(), 7),
          pattern: detectNotablePattern(byChannel, bySource),
        }
      }

      const result = await postAgent<{ sent: boolean; reason?: string }>("/api/notifications/test", body, "Test email")
      setMessage(result.sent ? `Sent to ${notificationEmail}.` : (result.reason ?? "Nothing to send right now."))
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Couldn't send the test email.")
    } finally {
      setSending(null)
    }
  }

  const buttons: { type: TestType; label: string }[] = [
    { type: "follow-up", label: "Test: Follow-up reminder" },
    { type: "new-match", label: "Test: New match" },
    { type: "weekly-digest", label: "Test: Weekly digest" },
  ]

  return (
    <div
      className="mt-6 flex flex-col gap-3 rounded-xl border p-6"
      style={{ borderColor: colors.border, backgroundColor: colors.panel }}
    >
      <div>
        <h3 className="text-sm font-semibold" style={{ color: colors.text }}>
          Test notification emails
        </h3>
        <p className="mt-1 text-xs" style={{ color: colors.muted }}>
          Sends real content from your current data to your notification email above — not placeholder text. If
          there's nothing to send (no follow-ups due, no jobs above 70), it says so instead of faking it. Tailored
          materials aren't here — every real "Generate tailored materials" call already sends one.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {buttons.map((b) => (
          <button
            key={b.type}
            type="button"
            disabled={sending !== null}
            onClick={() => send(b.type)}
            className="rounded-md border px-3 py-1.5 text-sm font-medium transition-colors hover:opacity-90 disabled:opacity-50"
            style={{ borderColor: colors.border, color: colors.text }}
          >
            {sending === b.type ? "Sending…" : b.label}
          </button>
        ))}
      </div>
      {message && (
        <p className="text-sm" style={{ color: colors.muted }}>
          {message}
        </p>
      )}
    </div>
  )
}

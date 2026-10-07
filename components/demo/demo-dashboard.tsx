"use client"

import { useMemo, useState } from "react"
import { colors } from "@/lib/theme"
import {
  DEMO_APPLICATIONS,
  DEMO_REVIEW_QUEUE,
  DEMO_CASE_FILE,
  DEMO_OVERALL,
  DEMO_BY_CHANNEL,
  DEMO_PURSUE_RATES,
  type DemoApplication,
  type DemoJob,
  type DemoColumn,
} from "@/lib/demo/demo-data"

// Public, no-login showcase (/demo) — a visitor shouldn't need an account
// to see what Groundwork does. Deliberately a SEPARATE component tree
// from components/applications-dashboard.tsx and friends, not a "demo
// mode" flag threaded through the real Firestore-backed hooks: this is
// the one place in the app meant to be shared with strangers, so it's
// built to be structurally incapable of touching real data or spending
// real API budget, rather than trusted to a conditional branch inside
// code whose main job is talking to a live account. Everything here is
// local React state seeded from lib/demo/demo-data.ts — a refresh resets
// it, and nothing here ever calls Firestore or Anthropic.

const COLUMN_ORDER: DemoColumn[] = ["Found", "Applied", "Interview", "Offer", "Rejected"]

type View = "applications" | "review" | "analytics"

function DemoBanner() {
  return (
    <div
      className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 border-b px-4 py-2 text-center text-xs"
      style={{ borderColor: colors.border, backgroundColor: "rgba(245,166,35,0.08)", color: colors.amber }}
    >
      <span>You&apos;re viewing a live demo with sample data — nothing here is a real account, and nothing you do is saved.</span>
      <a href="https://github.com/8fn4wf8phr-ops/GroundWork" target="_blank" rel="noreferrer" className="underline underline-offset-2">
        See the real README
      </a>
    </div>
  )
}

function NavTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
      style={{ backgroundColor: active ? colors.teal : "transparent", color: active ? colors.bg : colors.muted }}
    >
      {label}
    </button>
  )
}

function MatchScoreBadge({ score }: { score: number }) {
  const tone = score >= 60 ? colors.teal : score >= 30 ? colors.amber : colors.muted
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-xs font-semibold"
      style={{ color: tone, backgroundColor: `${tone}20` }}
    >
      {score}% match
    </span>
  )
}

function ReviewQueueDemo({
  jobs,
  onDecide,
}: {
  jobs: DemoJob[]
  onDecide: (id: string, decision: "pursue" | "dismiss") => void
}) {
  return (
    <div className="mx-auto w-full max-w-3xl p-4 sm:p-6">
      <h2 className="text-xl font-bold" style={{ color: colors.text, fontFamily: "var(--font-space-grotesk)" }}>
        Review queue
      </h2>
      <p className="mt-1 mb-4 text-sm" style={{ color: colors.muted }}>
        Newly discovered postings awaiting your call — try Pursue or Dismiss below.
      </p>
      {jobs.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm" style={{ borderColor: colors.border, color: colors.muted }}>
          Nothing left in the demo queue — reload the page to reset it.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {jobs.map((job) => (
            <div key={job.id} className="rounded-lg border p-4" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold" style={{ color: colors.text }}>
                    {job.title}
                  </h3>
                  <p className="mt-0.5 text-sm" style={{ color: colors.muted }}>
                    {job.company} · {job.location}
                  </p>
                </div>
                <MatchScoreBadge score={job.matchScore} />
              </div>
              <ul className="mt-2.5 flex flex-col gap-1">
                {job.matchReasons.map((reason) => (
                  <li key={reason} className="text-xs" style={{ color: reason.startsWith("Possible red flag") || reason.startsWith("Senior-level") ? colors.amber : colors.muted }}>
                    {reason.startsWith("Possible red flag") ? "⚠ " : "· "}
                    {reason}
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => onDecide(job.id, "pursue")}
                  className="rounded-md px-3 py-1.5 text-sm font-semibold transition-opacity hover:opacity-90"
                  style={{ backgroundColor: colors.teal, color: colors.bg }}
                >
                  Pursue
                </button>
                <button
                  type="button"
                  onClick={() => onDecide(job.id, "dismiss")}
                  className="rounded-md border px-3 py-1.5 text-sm font-medium transition-colors hover:opacity-90"
                  style={{ borderColor: colors.border, color: colors.text }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function KanbanCard({ app }: { app: DemoApplication }) {
  return (
    <div
      className="rounded-lg border p-3.5"
      style={{ backgroundColor: colors.card, borderColor: app.highlight ? colors.teal : colors.border }}
    >
      <h3 className="text-sm font-semibold" style={{ color: colors.text }}>
        {app.title}
      </h3>
      <p className="mt-0.5 text-sm" style={{ color: colors.muted }}>
        {app.company}
      </p>
      {app.channel && (
        <span
          className="mt-2.5 inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium"
          style={{ color: colors.muted, backgroundColor: "rgba(139,149,161,0.12)" }}
        >
          {app.channel}
        </span>
      )}
    </div>
  )
}

function CaseFileDemo() {
  return (
    <aside className="w-full shrink-0 p-4 sm:p-6 lg:w-[380px]">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold" style={{ color: colors.text, fontFamily: "var(--font-space-grotesk)" }}>
          Case file
        </h2>
        <span className="flex items-center gap-1.5 text-sm" style={{ color: colors.muted }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: colors.teal }} />
          Live
        </span>
      </div>
      <ul className="flex flex-col gap-3">
        {DEMO_CASE_FILE.map((entry) => (
          <li key={entry.id} className="rounded-lg border p-3" style={{ borderColor: entry.needsYourCall ? colors.amber : colors.border, backgroundColor: colors.card }}>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: colors.teal }}>
                {entry.agent}
              </span>
              {entry.needsYourCall && (
                <span className="text-xs font-semibold" style={{ color: colors.amber }}>
                  Needs your call
                </span>
              )}
            </div>
            <p className="text-sm leading-relaxed" style={{ color: colors.text }}>
              {entry.message}
            </p>
          </li>
        ))}
      </ul>
    </aside>
  )
}

function ApplicationsDemo({ applications }: { applications: DemoApplication[] }) {
  const columns = useMemo(() => {
    const byStatus = new Map<DemoColumn, DemoApplication[]>()
    for (const app of applications) {
      const list = byStatus.get(app.status) ?? []
      list.push(app)
      byStatus.set(app.status, list)
    }
    return COLUMN_ORDER.filter((c) => byStatus.has(c)).map((c) => ({ title: c, apps: byStatus.get(c)! }))
  }, [applications])

  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      <section className="min-w-0 flex-1 border-b p-4 sm:p-6 lg:border-b-0 lg:border-r" style={{ borderColor: colors.border }}>
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold" style={{ color: colors.text, fontFamily: "var(--font-space-grotesk)" }}>
            Applications
          </h2>
          <span className="text-sm" style={{ color: colors.muted }}>
            {applications.length} total
          </span>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {columns.map((col) => (
            <div key={col.title} className="flex min-w-0 flex-col gap-3">
              <span className="text-xs font-medium uppercase tracking-wide" style={{ color: colors.muted }}>
                {col.title}
              </span>
              <div className="flex flex-col gap-3">
                {col.apps.map((app) => (
                  <KanbanCard key={app.id} app={app} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
      <CaseFileDemo />
    </div>
  )
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-4" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
      <span className="text-xs" style={{ color: colors.muted }}>
        {label}
      </span>
      <div className="mt-1 text-2xl font-bold" style={{ color: colors.text, fontFamily: "var(--font-space-grotesk)" }}>
        {value}
      </div>
    </div>
  )
}

function RateMeterDemo({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 shrink-0 text-xs" style={{ color: colors.muted }}>
        {label}
      </span>
      <div className="h-2 flex-1 overflow-hidden rounded-full" style={{ backgroundColor: "rgba(53,201,193,0.15)" }}>
        <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, value))}%`, backgroundColor: colors.teal }} />
      </div>
      <span className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums" style={{ color: colors.text }}>
        {value}%
      </span>
    </div>
  )
}

function AnalyticsDemo() {
  return (
    <div className="mx-auto w-full max-w-3xl p-4 sm:p-6">
      <h2 className="text-xl font-bold" style={{ color: colors.text, fontFamily: "var(--font-space-grotesk)" }}>
        Analytics
      </h2>
      <p className="mt-1 mb-6 text-sm" style={{ color: colors.muted }}>
        What&apos;s actually working — response, interview, and offer rates, sliced by channel and source.
      </p>
      <div className="flex flex-col gap-8">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Total applications" value={String(DEMO_OVERALL.totalApplications)} />
          <StatTile label="Response rate" value={`${DEMO_OVERALL.responseRate}%`} />
          <StatTile label="Interview rate" value={`${DEMO_OVERALL.interviewRate}%`} />
          <StatTile label="Offer rate" value={`${DEMO_OVERALL.offerRate}%`} />
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide" style={{ color: colors.muted }}>
            By channel
          </h3>
          <div className="flex flex-col gap-3">
            {DEMO_BY_CHANNEL.map((group) => (
              <div key={group.label} className="rounded-lg border p-4" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-semibold" style={{ color: colors.text }}>
                    {group.label}
                  </span>
                  <span className="text-xs" style={{ color: colors.muted }}>
                    {group.appliedCount} applied
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  <RateMeterDemo label="Response" value={group.responseRate} />
                  <RateMeterDemo label="Interview" value={group.interviewRate} />
                  <RateMeterDemo label="Offer" value={group.offerRate} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide" style={{ color: colors.muted }}>
            Pursue rate by source
          </h3>
          <p className="mb-3 text-xs" style={{ color: colors.muted }}>
            Of everything each source has turned up, what fraction got pursued vs. dismissed — a consistently-ignored source is a candidate to turn off.
          </p>
          <div className="flex flex-col gap-3">
            {DEMO_PURSUE_RATES.map((group) => (
              <div key={group.label} className="rounded-lg border p-4" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-semibold" style={{ color: colors.text }}>
                    {group.label}
                  </span>
                  <span className="text-xs" style={{ color: colors.muted }}>
                    {group.discovered} discovered
                  </span>
                </div>
                <RateMeterDemo label="Pursue" value={group.pursueRate} />
                <p className="mt-2 text-xs" style={{ color: colors.muted }}>
                  {group.pursued} pursued · {group.dismissed} dismissed · {group.pending} still pending
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function DemoDashboard() {
  const [view, setView] = useState<View>("applications")
  const [queue, setQueue] = useState(DEMO_REVIEW_QUEUE)
  const [applications, setApplications] = useState(DEMO_APPLICATIONS)

  const decide = (id: string, decision: "pursue" | "dismiss") => {
    const job = queue.find((j) => j.id === id)
    setQueue((prev) => prev.filter((j) => j.id !== id))
    if (job && decision === "pursue") {
      setApplications((prev) => [{ id: `demo-${job.id}`, title: job.title, company: job.company, status: "Found" }, ...prev])
    }
  }

  return (
    <div className="flex min-h-screen flex-col font-sans" style={{ backgroundColor: colors.bg, color: colors.text, fontFamily: "var(--font-inter)" }}>
      <DemoBanner />
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-6 sm:py-4" style={{ borderColor: colors.border }}>
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold" style={{ color: colors.text, fontFamily: "var(--font-space-grotesk)" }}>
            Groundwork
          </h1>
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: colors.teal }} />
          <span className="text-sm" style={{ color: colors.muted }}>
            Demo
          </span>
        </div>
        <nav className="flex items-center gap-1" aria-label="Demo views">
          <NavTab label="Applications" active={view === "applications"} onClick={() => setView("applications")} />
          <NavTab label="Review queue" active={view === "review"} onClick={() => setView("review")} />
          <NavTab label="Analytics" active={view === "analytics"} onClick={() => setView("analytics")} />
        </nav>
      </header>

      {view === "applications" ? (
        <ApplicationsDemo applications={applications} />
      ) : view === "review" ? (
        <ReviewQueueDemo jobs={queue} onDecide={decide} />
      ) : (
        <AnalyticsDemo />
      )}
    </div>
  )
}

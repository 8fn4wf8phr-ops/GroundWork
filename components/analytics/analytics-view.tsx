"use client"

import { colors } from "@/lib/theme"
import { useApplications } from "@/lib/hooks/use-applications"
import { computeOverallStats, computeRatesByChannel, computeRatesBySource, type RateGroup } from "@/lib/analytics"
import { computeRejectionPatterns } from "@/lib/rejection-reasons"
import RateMeter from "@/components/analytics/rate-meter"
import type { ApplicationWithJob } from "@/lib/types"

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

function GroupSection({ title, groups }: { title: string; groups: RateGroup[] }) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide" style={{ color: colors.muted }}>
        {title}
      </h3>
      {groups.length === 0 ? (
        <p className="text-sm" style={{ color: colors.muted }}>
          No applied applications yet in this breakdown.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((group) => (
            <div key={group.key} className="rounded-lg border p-4" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold" style={{ color: colors.text }}>
                  {group.label}
                </span>
                <span className="text-xs" style={{ color: colors.muted }}>
                  {group.appliedCount} applied
                  {group.appliedCount < 3 ? " — not enough data yet" : ""}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                <RateMeter label="Response" value={group.responseRate} />
                <RateMeter label="Interview" value={group.interviewRate} />
                <RateMeter label="Offer" value={group.offerRate} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function RejectionPatternsSection({ applications }: { applications: ApplicationWithJob[] }) {
  const patterns = computeRejectionPatterns(applications)
  return (
    <div>
      <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide" style={{ color: colors.muted }}>
        Rejection patterns
      </h3>
      <p className="mb-3 text-xs" style={{ color: colors.muted }}>
        Grouped by exact wording (after trimming/case) — not paraphrase detection, so &quot;went with an internal
        candidate&quot; and &quot;they hired internally&quot; count separately.
      </p>
      {patterns.length === 0 ? (
        <p className="text-sm" style={{ color: colors.muted }}>
          No rejection reasons logged yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {patterns.map((p) => (
            <li
              key={p.reason}
              className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: colors.border, backgroundColor: colors.card }}
            >
              <span style={{ color: colors.text }}>{p.reason}</span>
              <span
                className="shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold"
                style={
                  p.count >= 2
                    ? { color: colors.teal, backgroundColor: "rgba(53,201,193,0.12)" }
                    : { color: colors.muted, backgroundColor: "rgba(139,149,161,0.12)" }
                }
              >
                {p.count}×
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function AnalyticsView() {
  const { applications, loading } = useApplications()
  const overall = computeOverallStats(applications)
  const byChannel = computeRatesByChannel(applications)
  const bySource = computeRatesBySource(applications)

  if (loading) {
    return (
      <div className="p-6 text-sm" style={{ color: colors.muted }}>
        Loading…
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-3xl p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold" style={{ color: colors.text, fontFamily: "var(--font-space-grotesk)" }}>
          Analytics
        </h2>
        <p className="mt-1 text-sm" style={{ color: colors.muted }}>
          What&apos;s actually working — response, interview, and offer rates, sliced by channel and source.
        </p>
      </div>

      {overall.appliedCount === 0 ? (
        <div
          className="rounded-lg border border-dashed p-8 text-center text-sm"
          style={{ borderColor: colors.border, color: colors.muted }}
        >
          Nothing to analyze yet — once you&apos;ve applied to a few postings, rates will show up here.
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Total applications" value={String(overall.totalApplications)} />
            <StatTile label="Response rate" value={`${overall.responseRate}%`} />
            <StatTile label="Interview rate" value={`${overall.interviewRate}%`} />
            <StatTile label="Offer rate" value={`${overall.offerRate}%`} />
          </div>

          <GroupSection title="By channel" groups={byChannel} />
          <GroupSection title="By source" groups={bySource} />
          <RejectionPatternsSection applications={applications} />
        </div>
      )}
    </div>
  )
}

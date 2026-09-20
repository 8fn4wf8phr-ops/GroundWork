"use client"

import { colors } from "@/lib/theme"
import { isOverdueForFollowUp } from "@/lib/followups"
import type { ApplicationWithJob } from "@/lib/types"

export default function NeedsFollowUpBanner({
  applications,
  onSelect,
}: {
  applications: ApplicationWithJob[]
  onSelect: (id: string) => void
}) {
  const overdue = applications.filter((a) => isOverdueForFollowUp(a))
  if (overdue.length === 0) return null

  return (
    <div
      className="mb-5 rounded-xl border p-4"
      style={{ borderColor: colors.amber, backgroundColor: "rgba(245,166,35,0.06)" }}
    >
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colors.amber }} />
        <span className="text-sm font-semibold" style={{ color: colors.amber }}>
          Needs follow-up ({overdue.length})
        </span>
      </div>
      <ul className="mt-3 flex flex-col gap-2">
        {overdue.map((app) => (
          <li key={app.id}>
            <button
              type="button"
              onClick={() => onSelect(app.id)}
              className="flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:opacity-90"
              style={{ borderColor: colors.border, backgroundColor: colors.card }}
            >
              <span style={{ color: colors.text }}>
                {app.job?.title ?? "Untitled role"}
                <span style={{ color: colors.muted }}> · {app.job?.company ?? "Unknown company"}</span>
              </span>
              <span className="shrink-0 text-xs" style={{ color: colors.amber }}>
                {app.followUpDate ? "Follow-up date passed" : "10+ business days, no response"}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

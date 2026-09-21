"use client"

import { colors } from "@/lib/theme"
import { useCaseFile } from "@/lib/hooks/use-case-file"
import { resolveCaseFileEntry } from "@/lib/firestore/case-file"
import type { AgentName, CaseFileEntry } from "@/lib/types"

const AGENT_COLOR: Partial<Record<AgentName, string>> = {
  Compass: colors.teal,
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffMin = Math.round(diffMs / 60000)
  if (diffMin < 1) return "just now"
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.round(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  return `${Math.round(diffHr / 24)}d ago`
}

function CaseFileEntryRow({ entry }: { entry: CaseFileEntry }) {
  return (
    <li className="flex gap-3">
      <div
        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border"
        style={{ borderColor: colors.border }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={colors.muted} strokeWidth="1.5" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-sm">
          <span className="font-semibold" style={{ color: AGENT_COLOR[entry.agent] ?? colors.text }}>
            {entry.agent}
          </span>
          <span style={{ color: colors.muted }}>· {relativeTime(entry.createdAt)}</span>
        </div>
        <p className="mt-1 text-sm leading-relaxed" style={{ color: colors.text }}>
          {entry.message}
        </p>
      </div>
    </li>
  )
}

function NeedsYourCallCard({ entry, allEntries }: { entry: CaseFileEntry; allEntries: CaseFileEntry[] }) {
  // The other side of the disagreement. Grouped by jobId when the
  // exchange is about a specific Job (Compass/Scout), or by threadId when
  // it isn't (Lens/Ledger's channel/source digest) — never by "no jobId"
  // alone, which would also match unrelated entries from a completely
  // different exchange that also happens to lack a jobId. `<=` rather
  // than `<`: entries in one exchange share createdAt (written as a
  // batch — see createCaseFileEntries), so a strict `<` would incorrectly
  // exclude a genuine same-timestamp match.
  const otherSide = allEntries
    .filter((e) => {
      if (e.agent === entry.agent || e.createdAt > entry.createdAt) return false
      if (entry.jobId) return e.jobId === entry.jobId
      if (entry.threadId) return e.threadId === entry.threadId
      return false
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]

  const resolve = (resolution: string) => resolveCaseFileEntry(entry.id, resolution)

  return (
    <div className="rounded-xl border p-4" style={{ borderColor: colors.amber, backgroundColor: "rgba(245,166,35,0.06)" }}>
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colors.amber }} />
        <span className="text-sm font-semibold" style={{ color: colors.amber }}>
          Needs your call
        </span>
      </div>
      <p className="mt-2.5 text-sm leading-relaxed" style={{ color: colors.text }}>
        {otherSide && (
          <>
            <span className="font-semibold">{otherSide.agent}:</span> {otherSide.message}
            <br />
          </>
        )}
        <span className="font-semibold">{entry.agent}:</span> {entry.message}
      </p>
      <div className="mt-4 flex flex-wrap gap-2.5">
        <button
          type="button"
          onClick={() => resolve(`Sided with ${entry.agent}`)}
          className="rounded-md px-3.5 py-1.5 text-sm font-semibold transition-opacity hover:opacity-90"
          style={{ backgroundColor: colors.amber, color: colors.bg }}
        >
          {entry.agent} is right
        </button>
        {otherSide && (
          <button
            type="button"
            onClick={() => resolve(`Sided with ${otherSide.agent}`)}
            className="rounded-md border px-3.5 py-1.5 text-sm font-medium transition-colors"
            style={{ borderColor: colors.border, color: colors.text }}
          >
            {otherSide.agent} is right
          </button>
        )}
      </div>
    </div>
  )
}

export default function CaseFileFeed() {
  const { entries, loading } = useCaseFile()
  const openEscalation = entries.find((e) => e.needsYourCall && !e.resolvedAt)

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold" style={{ color: colors.text, fontFamily: "var(--font-space-grotesk)" }}>
          Case file
        </h2>
        <span className="flex items-center gap-1.5 text-sm" style={{ color: colors.muted }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: colors.teal }} />
          Live
        </span>
      </div>

      {loading ? (
        <p className="text-sm" style={{ color: colors.muted }}>
          Loading…
        </p>
      ) : entries.length === 0 ? (
        <p className="text-sm" style={{ color: colors.muted }}>
          Nothing yet — pull new postings in the Review Queue to see the agents at work.
        </p>
      ) : (
        <ul className="flex flex-col gap-5">
          {entries.slice(0, 20).map((entry) => (
            <CaseFileEntryRow key={entry.id} entry={entry} />
          ))}
        </ul>
      )}

      {openEscalation && (
        <div className="mt-5">
          <NeedsYourCallCard entry={openEscalation} allEntries={entries} />
        </div>
      )}
    </>
  )
}

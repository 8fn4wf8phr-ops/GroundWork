import type { Application } from "@/lib/types"

// Rejection reasons are free text (spec §4), not a fixed enum, so "pattern
// surfacing" here is honest about what it actually does: exact-match
// grouping after trim/whitespace/case normalization — not real NLP, no
// paraphrase detection ("went with an internal candidate" and "they hired
// internally" are two different groups). This mirrors the match-scoring
// algorithm's own honesty about being keyword-overlap, not something
// smarter. Spec §7 gives Ledger the job of "keeping the rejection-reason
// list from sprawling into near-duplicate tags" — the autocomplete this
// file also powers (existingRejectionReasons, used in the detail modal)
// does more to actually prevent sprawl than counting it after the fact.

function normalize(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase()
}

export type RejectionPattern = { reason: string; count: number }

export function computeRejectionPatterns(applications: Application[]): RejectionPattern[] {
  const groups = new Map<string, { display: string; count: number }>()
  for (const app of applications) {
    const raw = app.rejectionReason?.trim()
    if (!raw) continue
    const key = normalize(raw)
    const existing = groups.get(key)
    if (existing) {
      existing.count += 1
    } else {
      groups.set(key, { display: raw, count: 1 })
    }
  }
  return [...groups.values()]
    .map((g) => ({ reason: g.display, count: g.count }))
    .sort((a, b) => b.count - a.count)
}

// Distinct previously-used reasons, most recent first — feeds the
// autocomplete in the detail modal so re-typing the same feedback in
// slightly different words is the exception, not the default.
export function existingRejectionReasons(applications: Application[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const app of applications) {
    const raw = app.rejectionReason?.trim()
    if (!raw) continue
    const key = normalize(raw)
    if (seen.has(key)) continue
    seen.add(key)
    result.push(raw)
  }
  return result
}

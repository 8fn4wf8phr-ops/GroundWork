import type { RateGroup } from "@/lib/analytics"

// The real version of the spec's own literal example (§2, §8): "Lens:
// Referral applications converting 3x better this month. Ledger: that's
// only two data points, not enough to trust yet." This finds the biggest
// real gap between two groups' response rates within one dimension
// (channel or source) — never a fabricated comparison — and flags
// whether the leading group's sample is small enough that Ledger has a
// legitimate statistical objection (the same appliedCount < 3 threshold
// already shown as "not enough data yet" in the Analytics view).
//
// A gap is only as trustworthy as its *thinner* side: a 10-application
// leader against a 1-application laggard is one data point, not a
// pattern — so lowConfidence checks both groups, not just the leader.
const MIN_NOTABLE_RATIO = 1.5
const MIN_NOTABLE_POINT_GAP = 20
const LOW_CONFIDENCE_THRESHOLD = 3

export type NotablePattern = {
  dimension: "channel" | "source"
  leaderLabel: string
  leaderRate: number
  leaderSampleSize: number
  laggardLabel: string
  laggardRate: number
  laggardSampleSize: number
  lowConfidence: boolean
}

// analytics.ts's catch-all buckets for applications with no channel /
// no known source. They aren't real channels or sources, so "unlabeled
// outreach outperforms Cold" is a comparison against a grab-bag, not a
// pattern the user could act on.
const CATCH_ALL_KEYS = new Set(["unspecified", "unknown"])

function biggestGapWithinDimension(
  groups: RateGroup[],
  dimension: "channel" | "source",
): NotablePattern | null {
  const withData = groups.filter((g) => g.appliedCount > 0 && !CATCH_ALL_KEYS.has(g.key))
  if (withData.length < 2) return null

  const sorted = [...withData].sort((a, b) => b.responseRate - a.responseRate)
  const leader = sorted[0]
  const laggard = sorted[sorted.length - 1]
  if (leader.key === laggard.key) return null

  const ratio = leader.responseRate / Math.max(laggard.responseRate, 1)
  const pointGap = leader.responseRate - laggard.responseRate
  const isNotable = ratio >= MIN_NOTABLE_RATIO && pointGap >= MIN_NOTABLE_POINT_GAP
  if (!isNotable) return null

  return {
    dimension,
    leaderLabel: leader.label,
    leaderRate: leader.responseRate,
    leaderSampleSize: leader.appliedCount,
    laggardLabel: laggard.label,
    laggardRate: laggard.responseRate,
    laggardSampleSize: laggard.appliedCount,
    lowConfidence:
      leader.appliedCount < LOW_CONFIDENCE_THRESHOLD || laggard.appliedCount < LOW_CONFIDENCE_THRESHOLD,
  }
}

// Prefers a well-sampled finding over a shaky one: if the channel gap
// rests on 1-2 applications but the source gap is solid, surface the
// source gap rather than escalating a "needs your call" over weak data.
// Ties (both confident, or both low-confidence) keep channel-first order.
export function detectNotablePattern(byChannel: RateGroup[], bySource: RateGroup[]): NotablePattern | null {
  const candidates = [
    biggestGapWithinDimension(byChannel, "channel"),
    biggestGapWithinDimension(bySource, "source"),
  ].filter((p): p is NotablePattern => p !== null)
  return candidates.find((p) => !p.lowConfidence) ?? candidates[0] ?? null
}

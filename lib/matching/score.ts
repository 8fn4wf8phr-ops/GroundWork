import type { DiscoveredJob } from "@/lib/discovery/types"
import type { Profile } from "@/lib/types"

// Match-scoring algorithm — spec Section 17 leaves "keyword overlap vs.
// something more structured" as an open question. This is the keyword-
// overlap v1: three weighted, individually-explainable components (title
// overlap, location/remote fit, must-have keywords), each contributing a
// human-readable reason so Compass's "always shows its work" principle
// (Section 7) holds even though the "agent" here is just this function.
// Deal-breakers are flagged, not scored — a red flag doesn't cancel out
// an otherwise strong match, it's a separate signal for the user to weigh.

const STOPWORDS = new Set(["and", "or", "the", "a", "an", "of", "for", "in", "at", "to"])

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9+#]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
}

export type MatchResult = {
  score: number
  reasons: string[]
  dealBreakerHit?: string
}

export function computeMatchScore(job: DiscoveredJob, profile: Profile): MatchResult {
  const reasons: string[] = []
  const titleTokens = new Set(tokenize(job.title))
  const haystack = tokenize(
    [job.title, job.description ?? "", ...(job.tags ?? [])].join(" "),
  ).join(" ")

  // Component 1 (0-50): does the title look like a role the user wants?
  let roleScore = 0
  for (const role of profile.targetRoles) {
    const roleTokens = tokenize(role)
    if (roleTokens.length === 0) continue
    const overlap = roleTokens.filter((t) => titleTokens.has(t)).length / roleTokens.length
    if (overlap > 0) {
      const points = Math.round(50 * overlap)
      if (points > roleScore) {
        roleScore = points
        reasons[0] = `Title overlaps with target role "${role}"`
      }
    }
  }

  // Component 2 (0-25): remote fit or a matching location.
  let locationScore = 0
  const wantsRemote = profile.locations.some((l) => /remote/i.test(l))
  if (job.remote && wantsRemote) {
    locationScore = 25
    reasons.push("Remote — matches your target locations")
  } else {
    const locationMatch = profile.locations.find(
      (l) => l.toLowerCase() !== "remote" && job.location.toLowerCase().includes(l.toLowerCase()),
    )
    if (locationMatch) {
      locationScore = 25
      reasons.push(`Location matches "${locationMatch}"`)
    }
  }

  // Component 3 (0-25): how many must-haves show up in the posting text.
  let mustHaveScore = 0
  if (profile.mustHaves.length > 0) {
    const matched = profile.mustHaves.filter((m) => haystack.includes(m.toLowerCase()))
    mustHaveScore = Math.round(25 * (matched.length / profile.mustHaves.length))
    for (const m of matched.slice(0, 2)) {
      reasons.push(`Mentions must-have: "${m}"`)
    }
  }

  const dealBreakerHit = profile.dealBreakers.find((d) => haystack.includes(d.toLowerCase()))
  if (dealBreakerHit) {
    reasons.push(`Possible red flag: mentions "${dealBreakerHit}"`)
  }

  return {
    score: Math.min(100, roleScore + locationScore + mustHaveScore),
    reasons: reasons.filter(Boolean),
    dealBreakerHit,
  }
}

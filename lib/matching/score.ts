import type { DiscoveredJob } from "@/lib/discovery/types"
import type { Profile } from "@/lib/types"

// Match-scoring algorithm — spec Section 17 leaves "keyword overlap vs.
// something more structured" as an open question. This is the keyword-
// overlap v1: weighted, individually-explainable components (title
// overlap, location/remote fit, must-have keywords, resume-skills
// overlap), each contributing a human-readable reason so Compass's
// "always shows its work" principle (Section 7) holds even though the
// "agent" here is just this function. Deal-breakers are flagged, not
// scored — a red flag doesn't cancel out an otherwise strong match, it's
// a separate signal for the user to weigh. Seniority mismatch is the one
// exception that IS scored (see below): real user feedback was that
// Staff/Principal/Director titles were still landing at 55-75%, which is
// a scoring bug, not just a flag-worthy signal.

const STOPWORDS = new Set(["and", "or", "the", "a", "an", "of", "for", "in", "at", "to"])

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9+#]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
}

// Below this score, Compass's LLM commentary is skipped entirely (the
// job is still saved and still visible in the Review queue) — cheap
// rules decide first, the model only narrates what already cleared a
// real bar. Overridden by Profile.autoDismissBelow when the user has set
// one, so there's a single mental model ("below this number, Compass
// doesn't bother") rather than two separate thresholds to configure.
export const DEFAULT_COMMENTARY_THRESHOLD = 50

// A posting whose title carries one of these words is a different
// seniority tier than what most of this project's users are targeting.
// Word-boundary matched against the raw (untokenized) title so multi-word
// phrases like "head of" still match.
const SENIOR_TITLE_PATTERN = /\b(senior|sr\.?|staff|lead|principal|director|vp|vice president|head of)\b/i

// Checked against the raw title+description (not the tokenized haystack,
// which strips punctuation like the slash in "TS/SCI") — a built-in
// red flag independent of whatever the user has typed into their own
// Profile.dealBreakers list.
const CLEARANCE_PATTERN =
  /security clearance|clearance required|clearance eligib|ts\/sci|top secret|secret clearance|public trust clearance|active clearance|polygraph/i

export type MatchResult = {
  score: number
  reasons: string[]
  dealBreakerHit?: string
}

export function computeMatchScore(job: DiscoveredJob, profile: Profile, resumeSkills: string[] = []): MatchResult {
  const reasons: string[] = []
  const titleTokens = new Set(tokenize(job.title))
  const rawText = `${job.title} ${job.description ?? ""}`
  const haystack = tokenize([job.title, job.description ?? "", ...(job.tags ?? [])].join(" ")).join(" ")

  // Resume skills are an optional signal — scheduled discovery and the
  // manual pull both fetch the Resume alongside the Profile to get this,
  // but a Job still scores sensibly without it (weights below shift to
  // compensate rather than leaving 25 points permanently on the table for
  // a user who hasn't filled out Skills yet).
  const hasSkills = resumeSkills.length > 0
  const ROLE_WEIGHT = hasSkills ? 40 : 50
  const LOCATION_WEIGHT = hasSkills ? 15 : 25
  const MUSTHAVE_WEIGHT = hasSkills ? 20 : 25
  const SKILLS_WEIGHT = hasSkills ? 25 : 0

  // Component: does the title look like a role the user wants?
  let roleScore = 0
  for (const role of profile.targetRoles) {
    const roleTokens = tokenize(role)
    if (roleTokens.length === 0) continue
    const overlap = roleTokens.filter((t) => titleTokens.has(t)).length / roleTokens.length
    if (overlap > 0) {
      const points = Math.round(ROLE_WEIGHT * overlap)
      if (points > roleScore) {
        roleScore = points
        reasons[0] = `Title overlaps with target role "${role}"`
      }
    }
  }

  // Component: remote fit or a matching location.
  let locationScore = 0
  const wantsRemote = profile.locations.some((l) => /remote/i.test(l))
  if (job.remote && wantsRemote) {
    locationScore = LOCATION_WEIGHT
    reasons.push("Remote — matches your target locations")
  } else {
    const locationMatch = profile.locations.find(
      (l) => l.toLowerCase() !== "remote" && job.location.toLowerCase().includes(l.toLowerCase()),
    )
    if (locationMatch) {
      locationScore = LOCATION_WEIGHT
      reasons.push(`Location matches "${locationMatch}"`)
    }
  }

  // Component: how many must-haves show up in the posting text.
  let mustHaveScore = 0
  if (profile.mustHaves.length > 0) {
    const matched = profile.mustHaves.filter((m) => haystack.includes(m.toLowerCase()))
    mustHaveScore = Math.round(MUSTHAVE_WEIGHT * (matched.length / profile.mustHaves.length))
    for (const m of matched.slice(0, 2)) {
      reasons.push(`Mentions must-have: "${m}"`)
    }
  }

  // Component: how many resume skills show up in the posting text — a
  // direct "can I actually do this job" signal, independent of whether
  // the title matches a target role.
  let skillsScore = 0
  if (hasSkills) {
    const matchedSkills = resumeSkills.filter((s) => haystack.includes(s.toLowerCase()))
    skillsScore = Math.round(SKILLS_WEIGHT * (matchedSkills.length / resumeSkills.length))
    if (matchedSkills.length > 0) {
      reasons.push(
        `${matchedSkills.length} of your resume skills show up in the posting: ${matchedSkills.slice(0, 3).join(", ")}`,
      )
    }
  }

  const dealBreakerHit = profile.dealBreakers.find((d) => haystack.includes(d.toLowerCase()))
  if (dealBreakerHit) {
    reasons.push(`Possible red flag: mentions "${dealBreakerHit}"`)
  }
  if (CLEARANCE_PATTERN.test(rawText)) {
    reasons.push("Possible red flag: mentions a security clearance requirement")
  }

  let score = roleScore + locationScore + mustHaveScore + skillsScore

  // Seniority mismatch is scored, not just flagged: the real bug report
  // was Staff/Principal/Director titles still landing at 55-75% because
  // the title-overlap component only ever checked for role-NAME overlap
  // ("engineer" in "Staff Engineer"), never seniority. Skipped when one of
  // the user's own target roles names that same tier — someone actually
  // targeting "Senior Engineer" shouldn't be penalized for it.
  const titleSeniorityMatch = job.title.match(SENIOR_TITLE_PATTERN)
  const userTargetsThatSeniority = profile.targetRoles.some((r) => SENIOR_TITLE_PATTERN.test(r))
  if (titleSeniorityMatch && !userTargetsThatSeniority) {
    reasons.push(`Senior-level title ("${titleSeniorityMatch[0]}") doesn't match your target seniority — scored down`)
    score = Math.round(score * 0.25)
  }

  return {
    score: Math.min(100, score),
    reasons: reasons.filter(Boolean),
    dealBreakerHit,
  }
}

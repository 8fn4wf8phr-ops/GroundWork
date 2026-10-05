import type { NewCaseFileEntry } from "@/lib/firestore/case-file"
import type { Job, Profile } from "@/lib/types"
import { clip, postAgent } from "@/lib/agents/client"
import { buildReviewPayload } from "@/lib/agents/review-payload"
import { DEFAULT_COMMENTARY_THRESHOLD } from "@/lib/matching/score"

// Spec §2's day-in-the-life narrative uses "three" as the number of
// strong matches surfaced for review — kept here as the cap on how many
// newly-discovered jobs per pull get run through the agent commentary,
// both to control cost and to keep the case file meaningfully curated
// rather than narrating every single posting.
const MAX_JOBS_TO_REVIEW = 3

export async function reviewTopNewJobs(
  savedJobs: Job[],
  existingJobs: Job[],
  profile: Profile,
): Promise<NewCaseFileEntry[]> {
  // Cheap rule before the expensive one: a low scorer gets no LLM
  // commentary at all (still saved, still visible in the queue, just no
  // case-file note) — cuts AI cost and the 503/rate-limit risk of
  // narrating postings nobody was ever going to pursue. Reuses
  // Profile.autoDismissBelow as "the user's threshold" when they've set
  // one, so there's a single number to configure rather than two.
  const commentaryThreshold = profile.autoDismissBelow ?? DEFAULT_COMMENTARY_THRESHOLD

  // A saved Job already carries everything the concern check needs
  // (source, company, title, description), so there's no second,
  // index-aligned list of raw postings to keep in sync with it.
  const topJobs = savedJobs
    .filter((j) => j.reviewStatus !== "dismissed" && (j.matchScore ?? 0) >= commentaryThreshold)
    .sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0))
    .slice(0, MAX_JOBS_TO_REVIEW)

  if (topJobs.length === 0) return []

  const jobsPayload = topJobs.map((job) => buildReviewPayload(job, existingJobs))

  const { entries } = await postAgent<{ entries: NewCaseFileEntry[] }>(
    "/api/agents/review-jobs",
    { jobs: jobsPayload, profile: { targetRoles: profile.targetRoles.slice(0, 20).map((r) => clip(r, 200)) } },
    "Agent review",
  )
  return entries
}

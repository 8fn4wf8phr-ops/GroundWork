import type { NewCaseFileEntry } from "@/lib/firestore/case-file"
import type { Job, Profile } from "@/lib/types"
import { clip, postAgent } from "@/lib/agents/client"
import { detectConcernSignal } from "@/lib/agents/concern-signals"

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
  // A saved Job already carries everything the concern check needs
  // (source, company, title, description), so there's no second,
  // index-aligned list of raw postings to keep in sync with it.
  const topJobs = [...savedJobs]
    .sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0))
    .slice(0, MAX_JOBS_TO_REVIEW)

  if (topJobs.length === 0) return []

  const jobsPayload = topJobs.map((job) => ({
    jobId: job.id,
    title: clip(job.title, 300),
    company: clip(job.company, 300),
    location: clip(job.location, 300),
    matchScore: job.matchScore ?? 0,
    matchReasons: (job.matchReasons ?? []).slice(0, 20).map((r) => clip(r, 300)),
    concernSignal: detectConcernSignal(job, existingJobs),
  }))

  const { entries } = await postAgent<{ entries: NewCaseFileEntry[] }>(
    "/api/agents/review-jobs",
    { jobs: jobsPayload, profile: { targetRoles: profile.targetRoles.slice(0, 20).map((r) => clip(r, 200)) } },
    "Agent review",
  )
  return entries
}

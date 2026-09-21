import type { NewCaseFileEntry } from "@/lib/firestore/case-file"
import type { Job, Profile } from "@/lib/types"
import { detectConcernSignal } from "@/lib/agents/concern-signals"
import type { DiscoveredJob } from "@/lib/discovery/types"

// Spec §2's day-in-the-life narrative uses "three" as the number of
// strong matches surfaced for review — kept here as the cap on how many
// newly-discovered jobs per pull get run through the agent commentary,
// both to control cost and to keep the case file meaningfully curated
// rather than narrating every single posting.
const MAX_JOBS_TO_REVIEW = 3

export async function reviewTopNewJobs(
  savedJobs: Job[],
  savedDiscovered: DiscoveredJob[],
  existingJobs: Job[],
  profile: Profile,
): Promise<NewCaseFileEntry[]> {
  // savedJobs[i] and savedDiscovered[i] are the same posting — pairs each
  // one with its real Firestore id and computed matchScore/matchReasons.
  const topJobs = savedJobs
    .map((job, i) => ({ job, discovered: savedDiscovered[i] }))
    .sort((a, b) => (b.job.matchScore ?? 0) - (a.job.matchScore ?? 0))
    .slice(0, MAX_JOBS_TO_REVIEW)

  if (topJobs.length === 0) return []

  const jobsPayload = topJobs.map(({ job, discovered }) => ({
    jobId: job.id,
    title: job.title,
    company: job.company,
    location: job.location,
    matchScore: job.matchScore ?? 0,
    matchReasons: job.matchReasons ?? [],
    concernSignal: detectConcernSignal(discovered, existingJobs),
  }))

  const res = await fetch("/api/agents/review-jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jobs: jobsPayload,
      profile: { targetRoles: profile.targetRoles },
    }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Agent review returned ${res.status}`)
  }
  const body = (await res.json()) as { entries: NewCaseFileEntry[] }
  return body.entries
}

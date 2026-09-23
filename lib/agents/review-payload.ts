import { detectConcernSignal } from "@/lib/agents/concern-signals"
import { clip } from "@/lib/clip"
import type { Job } from "@/lib/types"

// Turns a saved Job into the payload /api/agents/review-jobs (and the
// shared reviewJobs()) expects: the deterministic score, its reasons, and
// Scout's computed concern signal, with third-party text trimmed to the
// route's limits. Shared by the browser flow and the scheduled cron so
// both send the model exactly the same facts.
export function buildReviewPayload(job: Job, existingJobs: Job[]) {
  return {
    jobId: job.id,
    title: clip(job.title, 300),
    company: clip(job.company, 300),
    location: clip(job.location, 300),
    matchScore: job.matchScore ?? 0,
    matchReasons: (job.matchReasons ?? []).slice(0, 20).map((r) => clip(r, 300)),
    concernSignal: detectConcernSignal(job, existingJobs),
  }
}

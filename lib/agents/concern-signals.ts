import type { DiscoveredJob } from "@/lib/discovery/types"
import type { Job } from "@/lib/types"

// A grounded, computable fact Scout can genuinely push back on — never an
// invented one. Two signals, both real and checkable against actual data:
// (1) the same company+title already showed up from a different source
// (a real cross-source repeat, not just our own dedup catching the same
// posting twice), or (2) the description is unusually short. The LLM
// narrates these facts in Scout's voice; it never generates the facts
// themselves.
//
// Note: a pull is always a single source (saveDiscoveredJobs keys its
// dedup off the first posting's source), so two postings from the same
// pull can never be a *cross-source* repeat of each other — comparing
// against previously-saved jobs is the complete check for this signal.
const VAGUE_DESCRIPTION_MAX_CHARS = 200

export function detectConcernSignal(job: DiscoveredJob, existingJobs: Job[]): string | null {
  const normalize = (s: string) => s.trim().toLowerCase()
  const crossSourceRepeat = existingJobs.find(
    (j) =>
      normalize(j.company) === normalize(job.company) &&
      normalize(j.title) === normalize(job.title) &&
      j.source !== job.source,
  )
  if (crossSourceRepeat) {
    const when = crossSourceRepeat.dateDiscovered.slice(0, 10)
    // A manual entry is the user's own record, not another job board —
    // saying it "showed up from a different source" would misdescribe it.
    return crossSourceRepeat.source === "manual"
      ? `This exact company + title is already in your tracker — you added it manually on ${when}.`
      : `This exact company + title also showed up from a different source (${crossSourceRepeat.source}), discovered on ${when}.`
  }

  const descriptionLength = (job.description ?? "").trim().length
  if (descriptionLength > 0 && descriptionLength < VAGUE_DESCRIPTION_MAX_CHARS) {
    return `The posting's description is unusually short (${descriptionLength} characters) — could be low-detail or boilerplate rather than a fully fleshed-out opening.`
  }

  return null
}

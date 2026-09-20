import type { DiscoveredJob } from "@/lib/discovery/types"
import type { Profile } from "@/lib/types"
import { stripHtml } from "@/lib/discovery/strip-html"

// Jobicy's public API — no key required, CORS-open (confirmed live).
// Unlike Arbeitnow, its `tag` param genuinely filters server-side and
// accepts a full phrase (confirmed live with "software engineer").
const JOBICY_ENDPOINT = "https://jobicy.com/api/v2/remote-jobs"

type JobicyPosting = {
  id: number
  url: string
  jobTitle: string
  companyName: string
  jobIndustry: string[]
  jobGeo: string
  jobDescription: string
  pubDate: string
}

async function fetchJobicyJobs(tag: string): Promise<DiscoveredJob[]> {
  const params = new URLSearchParams({ count: "50" })
  if (tag) params.set("tag", tag)

  const res = await fetch(`${JOBICY_ENDPOINT}?${params.toString()}`)
  if (!res.ok) {
    throw new Error(`Jobicy API returned ${res.status}`)
  }
  const body = (await res.json()) as { jobs: JobicyPosting[] }
  return body.jobs.map((posting) => ({
    title: posting.jobTitle,
    company: posting.companyName,
    location: posting.jobGeo || "Remote",
    remote: true,
    source: "jobicy",
    externalId: String(posting.id),
    tags: posting.jobIndustry,
    postingUrl: posting.url,
    datePosted: posting.pubDate,
    description: stripHtml(posting.jobDescription),
  }))
}

// Same per-target-role querying as Adzuna, capped at 3 roles — Jobicy's
// tag filter is real, so it's worth querying narrowly rather than pulling
// everything and scoring after the fact.
export async function fetchJobicyJobsForProfile(profile: Profile): Promise<DiscoveredJob[]> {
  const roles = profile.targetRoles.slice(0, 3)
  const batches = await Promise.all(roles.length > 0 ? roles.map((role) => fetchJobicyJobs(role)) : [fetchJobicyJobs("")])

  const seen = new Set<string>()
  const merged: DiscoveredJob[] = []
  for (const batch of batches) {
    for (const job of batch) {
      if (job.externalId) {
        if (seen.has(job.externalId)) continue
        seen.add(job.externalId)
      }
      merged.push(job)
    }
  }
  return merged
}

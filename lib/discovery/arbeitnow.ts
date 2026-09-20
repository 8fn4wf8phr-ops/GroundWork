import type { DiscoveredJob } from "@/lib/discovery/types"
import { stripHtml } from "@/lib/discovery/strip-html"

// Arbeitnow's public job board API — no key required, CORS-open
// (access-control-allow-origin: *, confirmed live), documented at
// https://www.arbeitnow.com/blog/job-board-api. Per spec Section 3, this
// is one of the sources whose provider explicitly wants third-party apps
// pulling their listings.
const ARBEITNOW_ENDPOINT = "https://www.arbeitnow.com/api/job-board-api"

type ArbeitnowPosting = {
  slug: string
  company_name: string
  title: string
  description: string
  remote: boolean
  url: string
  tags: string[]
  job_types: string[]
  location: string
  created_at: number
}

export async function fetchArbeitnowJobs(): Promise<DiscoveredJob[]> {
  const res = await fetch(ARBEITNOW_ENDPOINT)
  if (!res.ok) {
    throw new Error(`Arbeitnow API returned ${res.status}`)
  }
  const body = (await res.json()) as { data: ArbeitnowPosting[] }
  return body.data.map((posting) => ({
    title: posting.title,
    company: posting.company_name,
    location: posting.location || (posting.remote ? "Remote" : ""),
    remote: posting.remote,
    source: "arbeitnow",
    externalId: posting.slug,
    tags: posting.tags,
    postingUrl: posting.url,
    datePosted: new Date(posting.created_at * 1000).toISOString(),
    description: stripHtml(posting.description),
  }))
}

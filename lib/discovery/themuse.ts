import type { DiscoveredJob } from "@/lib/discovery/types"
import { stripHtml } from "@/lib/discovery/strip-html"
import type { Profile } from "@/lib/types"

// The Muse's public API — no key required, CORS-open (confirmed live).
// It does support a `category` filter, but only against its own fixed
// taxonomy (confirmed live values: "Software Engineering", "Data and
// Analytics", "Design and UX", etc. — NOT free text like "Engineer").
// Profile.targetRoles is free text with no reliable mapping onto that
// taxonomy, so this pulls broadly (optionally narrowed by `location`,
// which IS a genuine structured match against "Remote") and leaves
// relevance to the same title-overlap scoring every other source uses —
// same tradeoff Arbeitnow makes, for the same reason.
const THEMUSE_ENDPOINT = "https://www.themuse.com/api/public/jobs"

type ThemuseJob = {
  id: number
  name: string
  contents: string
  publication_date: string
  locations: { name: string }[]
  company: { name: string }
  refs: { landing_page: string }
  categories: { name: string }[]
}

export async function fetchThemuseJobs(profile: Profile): Promise<DiscoveredJob[]> {
  const params = new URLSearchParams({ page: "1" })
  if (profile.locations.some((l) => /remote/i.test(l))) {
    // Confirmed live: the API does a substring match, not exact — plain
    // "Remote" matches postings whose actual location value is "Flexible
    // / Remote".
    params.set("location", "Remote")
  }

  const res = await fetch(`${THEMUSE_ENDPOINT}?${params.toString()}`)
  if (!res.ok) {
    throw new Error(`The Muse API returned ${res.status}`)
  }
  const body = (await res.json()) as { results: ThemuseJob[] }

  return body.results.map((job) => {
    const locationNames = job.locations.map((l) => l.name)
    const remote = locationNames.some((l) => /remote/i.test(l))
    return {
      title: job.name,
      company: job.company?.name ?? "Unknown company",
      location: locationNames[0] ?? "",
      remote,
      source: "themuse",
      externalId: String(job.id),
      tags: job.categories.map((c) => c.name),
      postingUrl: job.refs?.landing_page,
      datePosted: job.publication_date,
      description: stripHtml(job.contents),
    }
  })
}

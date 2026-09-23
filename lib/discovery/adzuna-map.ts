import type { DiscoveredJob } from "@/lib/discovery/types"
import type { Profile } from "@/lib/types"

// Pure Adzuna logic shared by the browser fetcher (lib/discovery/adzuna.ts,
// which goes through our proxy route) and the server-side scheduled
// discovery (which calls Adzuna directly). Kept free of client-only
// imports so the server bundle never pulls in the Firebase client SDK.
export type AdzunaPosting = {
  id: string
  title: string
  description: string
  redirect_url: string
  created: string
  company: { display_name: string }
  location: { display_name: string }
  category?: { label: string }
}

export type AdzunaSearch = (what: string, where: string) => Promise<{ results?: AdzunaPosting[] }>

function mapPostings(body: { results?: AdzunaPosting[] }): DiscoveredJob[] {
  return (body.results ?? []).map((posting) => {
    const location = posting.location?.display_name ?? ""
    const remote = /remote/i.test(posting.title) || /remote/i.test(location)
    return {
      title: posting.title,
      company: posting.company?.display_name ?? "Unknown company",
      location,
      remote,
      source: "adzuna",
      externalId: posting.id,
      tags: posting.category?.label ? [posting.category.label] : [],
      postingUrl: posting.redirect_url,
      datePosted: posting.created,
      description: posting.description,
    }
  })
}

// Unlike Arbeitnow (which ignores search params and returns everything),
// Adzuna's `what` genuinely filters server-side — so it's worth querying
// per target role rather than pulling everything and scoring after the
// fact. Capped at 3 roles to keep the number of requests bounded.
export async function fetchAdzunaJobsForProfile(profile: Profile, search: AdzunaSearch): Promise<DiscoveredJob[]> {
  const roles = profile.targetRoles.slice(0, 3)
  const where = profile.locations.find((l) => !/remote/i.test(l)) ?? ""

  const batches = roles.length > 0 ? await Promise.all(roles.map(async (role) => mapPostings(await search(role, where)))) : [mapPostings(await search("", where))]

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

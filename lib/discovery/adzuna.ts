import type { DiscoveredJob } from "@/lib/discovery/types"
import type { Profile } from "@/lib/types"

type AdzunaPosting = {
  id: string
  title: string
  description: string
  redirect_url: string
  created: string
  company: { display_name: string }
  location: { display_name: string }
  category?: { label: string }
}

// Calls our own /api/discovery/adzuna route (server-side, holds the real
// key) rather than api.adzuna.com directly — see that route for why.
async function fetchAdzunaJobs(what: string, where: string): Promise<DiscoveredJob[]> {
  const params = new URLSearchParams()
  if (what) params.set("what", what)
  if (where) params.set("where", where)

  const res = await fetch(`/api/discovery/adzuna?${params.toString()}`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Adzuna proxy returned ${res.status}`)
  }
  const body = (await res.json()) as { results?: AdzunaPosting[] }

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
export async function fetchAdzunaJobsForProfile(profile: Profile): Promise<DiscoveredJob[]> {
  const roles = profile.targetRoles.slice(0, 3)
  const where = profile.locations.find((l) => !/remote/i.test(l)) ?? ""

  const batches = roles.length > 0 ? await Promise.all(roles.map((role) => fetchAdzunaJobs(role, where))) : [await fetchAdzunaJobs("", where)]

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

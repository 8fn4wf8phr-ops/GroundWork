import { authHeader } from "@/lib/auth-header"
import { fetchUsajobsForProfile as fetchForProfile, type UsajobsSearch } from "@/lib/discovery/usajobs-map"
import type { DiscoveredJob } from "@/lib/discovery/types"
import type { Profile } from "@/lib/types"

// Calls our own /api/discovery/usajobs route (server-side, holds the
// real key) rather than data.usajobs.gov directly — see that route for
// why.
const searchViaProxy: UsajobsSearch = async (keyword, remoteOnly) => {
  const params = new URLSearchParams()
  if (keyword) params.set("keyword", keyword)
  if (remoteOnly) params.set("remoteOnly", "true")

  const res = await fetch(`/api/discovery/usajobs?${params.toString()}`, { headers: await authHeader() })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `USAJobs proxy returned ${res.status}`)
  }
  return res.json()
}

export function fetchUsajobsForProfile(profile: Profile): Promise<DiscoveredJob[]> {
  return fetchForProfile(profile, searchViaProxy)
}

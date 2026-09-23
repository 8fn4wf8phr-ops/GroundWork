import { authHeader } from "@/lib/auth-header"
import { fetchAdzunaJobsForProfile as fetchForProfile, type AdzunaSearch } from "@/lib/discovery/adzuna-map"
import type { DiscoveredJob } from "@/lib/discovery/types"
import type { Profile } from "@/lib/types"

// Calls our own /api/discovery/adzuna route (server-side, holds the real
// key) rather than api.adzuna.com directly — see that route for why.
const searchViaProxy: AdzunaSearch = async (what, where) => {
  const params = new URLSearchParams()
  if (what) params.set("what", what)
  if (where) params.set("where", where)

  const res = await fetch(`/api/discovery/adzuna?${params.toString()}`, { headers: await authHeader() })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Adzuna proxy returned ${res.status}`)
  }
  return res.json()
}

export function fetchAdzunaJobsForProfile(profile: Profile): Promise<DiscoveredJob[]> {
  return fetchForProfile(profile, searchViaProxy)
}

import { authHeader } from "@/lib/auth-header"
import { fetchWeWorkRemotelyJobs as fetchViaSearch, type WwrSearch } from "@/lib/discovery/wwr-map"
import type { DiscoveredJob } from "@/lib/discovery/types"
import { fetchOrThrow } from "@/lib/fetch-friendly"

// Calls our own /api/discovery/wwr route (server-side) rather than
// weworkremotely.com directly — see that route for why.
const searchViaProxy: WwrSearch = async () => {
  const res = await fetchOrThrow("/api/discovery/wwr", { headers: await authHeader() }, "We Work Remotely")
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `We Work Remotely proxy returned ${res.status}`)
  }
  return res.text()
}

export function fetchWeWorkRemotelyJobs(): Promise<DiscoveredJob[]> {
  return fetchViaSearch(searchViaProxy)
}

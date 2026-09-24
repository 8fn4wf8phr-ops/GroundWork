import type { UsajobsPosting } from "@/lib/discovery/usajobs-map"

// The one place that builds and sends a request to data.usajobs.gov.
// USAJOBS_API_KEY is tied to the registrant's identity (User-Agent must
// be the email it was registered under, per USAJobs' own auth docs) —
// server-only, same reasoning as Adzuna's app_key.
export class UsajobsConfigError extends Error {}

export async function callUsajobs(
  keyword: string,
  remoteOnly: boolean,
): Promise<{ SearchResult?: { SearchResultItems?: UsajobsPosting[] } }> {
  const apiKey = process.env.USAJOBS_API_KEY
  const userAgent = process.env.USAJOBS_USER_AGENT
  if (!apiKey || !userAgent) {
    throw new UsajobsConfigError("USAJobs credentials are not configured (USAJOBS_API_KEY / USAJOBS_USER_AGENT).")
  }

  const url = new URL("https://data.usajobs.gov/api/search")
  url.searchParams.set("ResultsPerPage", "50")
  if (keyword) url.searchParams.set("Keyword", keyword)
  if (remoteOnly) url.searchParams.set("RemoteIndicator", "True")

  const res = await fetch(url.toString(), {
    headers: { Host: "data.usajobs.gov", "User-Agent": userAgent, "Authorization-Key": apiKey },
  })
  if (!res.ok) throw new Error(`USAJobs API returned ${res.status}`)
  return res.json()
}

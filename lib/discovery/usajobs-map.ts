import type { DiscoveredJob } from "@/lib/discovery/types"
import type { Profile } from "@/lib/types"

// Pure USAJobs mapping logic, shared by the browser fetcher (which goes
// through our proxy route — USAJobs sends no CORS header, confirmed
// live) and the server-side scheduled discovery (which calls the API
// directly). Kept free of client-only imports, same reasoning as
// lib/discovery/adzuna-map.ts.
export type UsajobsPosting = {
  MatchedObjectId: string
  MatchedObjectDescriptor: {
    PositionID: string
    PositionTitle: string
    PositionURI: string
    PositionLocationDisplay: string
    OrganizationName: string
    DepartmentName: string
    JobCategory?: { Name: string }[]
    PublicationStartDate: string
    UserArea: { Details: { JobSummary?: string; RemoteIndicator?: boolean } }
  }
}

export type UsajobsSearch = (keyword: string, remoteOnly: boolean) => Promise<{
  SearchResult?: { SearchResultItems?: UsajobsPosting[] }
}>

function mapPostings(body: { SearchResult?: { SearchResultItems?: UsajobsPosting[] } }): DiscoveredJob[] {
  return (body.SearchResult?.SearchResultItems ?? []).map((item) => {
    const d = item.MatchedObjectDescriptor
    return {
      title: d.PositionTitle,
      company: d.OrganizationName || d.DepartmentName || "U.S. Government",
      location: d.PositionLocationDisplay,
      remote: Boolean(d.UserArea.Details.RemoteIndicator),
      source: "usajobs",
      externalId: item.MatchedObjectId,
      tags: (d.JobCategory ?? []).map((c) => c.Name),
      postingUrl: d.PositionURI,
      datePosted: d.PublicationStartDate,
      // JobSummary is the short, human-written blurb; QualificationSummary
      // (not used here) runs to thousands of characters of federal
      // hiring-process boilerplate that isn't useful for match scoring.
      description: d.UserArea.Details.JobSummary ?? "",
    }
  })
}

// Confirmed live: `Keyword` genuinely filters server-side (11 results for
// "software developer" vs. 10000+ unfiltered), so — same treatment as
// Adzuna/Jobicy — this queries per target role rather than pulling
// everything and scoring after. `LocationName` was tested and rejected:
// a bare state name like "Florida" returned 1 result while "California"
// returned 1588, meaning it needs an exact match against USAJobs' own
// place-name taxonomy (specific cities, not free-text state names) —
// the same trap The Muse's category filter hit. `RemoteIndicator` is
// confirmed reliable (a real boolean, genuinely filters), so that's the
// only structured location signal used; everything else is left to the
// existing scoring algorithm, same tradeoff Arbeitnow and The Muse make.
export async function fetchUsajobsForProfile(profile: Profile, search: UsajobsSearch): Promise<DiscoveredJob[]> {
  const roles = profile.targetRoles.slice(0, 3)
  const remoteOnly = profile.locations.some((l) => /remote/i.test(l)) && !profile.locations.some((l) => !/remote/i.test(l))

  const batches = await Promise.all(
    roles.length > 0 ? roles.map((role) => search(role, remoteOnly).then(mapPostings)) : [search("", remoteOnly).then(mapPostings)],
  )

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

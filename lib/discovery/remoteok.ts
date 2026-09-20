import type { DiscoveredJob } from "@/lib/discovery/types"
import { stripHtml } from "@/lib/discovery/strip-html"

// RemoteOK's public API — no key required, CORS-open (confirmed live).
// Their terms require linking back and crediting RemoteOK as the source,
// which the app already does via postingUrl on every card.
const REMOTEOK_ENDPOINT = "https://remoteok.com/api"

type RemoteOkPosting = {
  slug: string
  id: string
  date: string
  company: string
  position: string
  tags: string[]
  description: string
  location: string
  url: string
}

export async function fetchRemoteOkJobs(): Promise<DiscoveredJob[]> {
  const res = await fetch(REMOTEOK_ENDPOINT)
  if (!res.ok) {
    throw new Error(`RemoteOK API returned ${res.status}`)
  }
  const body = (await res.json()) as unknown[]
  // The first array element is API terms/metadata, not a job — every
  // other RemoteOK client has to filter it out the same way.
  const postings = body.slice(1) as RemoteOkPosting[]
  return postings.map((posting) => ({
    title: posting.position,
    company: posting.company,
    location: posting.location || "Remote",
    remote: true,
    source: "remoteok",
    externalId: posting.id,
    tags: posting.tags,
    postingUrl: posting.url,
    datePosted: posting.date,
    description: stripHtml(posting.description),
  }))
}

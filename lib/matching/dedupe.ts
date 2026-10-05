// Cross-source posting identity. A source's own externalId only
// disambiguates postings FROM THAT SAME SOURCE (ids aren't shared across
// APIs, and aren't guaranteed unique between them either) — it's a second
// identity key, not a replacement for company+title. Without the
// company+title key, the same real posting cross-listed on two boards
// (e.g. Adzuna and Arbeitnow both carrying the same req) shows up twice in
// the Review queue as two unrelated Jobs, since each has its own,
// unrelated externalId.
export type JobIdentity = { source: string; externalId?: string; company: string; title: string }

const normalize = (s: string) => s.trim().toLowerCase()

export function jobIdentityKeys(job: JobIdentity): string[] {
  const keys = [`ct|${normalize(job.company)}|${normalize(job.title)}`]
  if (job.externalId) keys.push(`${job.source}|id|${job.externalId}`)
  return keys
}

export function hasSeenJob(seen: Set<string>, job: JobIdentity): boolean {
  return jobIdentityKeys(job).some((k) => seen.has(k))
}

export function markSeenJob(seen: Set<string>, job: JobIdentity): void {
  for (const key of jobIdentityKeys(job)) seen.add(key)
}

import { buildReviewPayload } from "@/lib/agents/review-payload"
import { clip } from "@/lib/clip"
import type { DiscoveredJob } from "@/lib/discovery/types"
import { computeMatchScore } from "@/lib/matching/score"
import { MAX_JOBS_PER_REVIEW, type CaseFileEntryDraft, type ProfileInput, type JobInput } from "@/lib/server/review-jobs"
import { SCHEDULED_SOURCES, type Job, type Profile, type ScheduledSourceId } from "@/lib/types"

// Scheduled discovery: a daily server-side pull for users who opted in,
// running the same pipeline as a manual "Pull new postings" click —
// fetch → dedupe → score → save → Compass/Scout commentary on the top few
// — but with no browser and no signed-in user. Everything that touches
// Firestore goes through DiscoveryStore, so the orchestration below can be
// tested without credentials; lib/server/admin-store.ts is the real
// implementation on the Firebase Admin SDK (which bypasses security rules,
// so every query there is scoped by owner explicitly).

// Cost and noise controls. A manual pull saves every posting it finds
// (Arbeitnow returns ~250); doing that unattended, daily, would bury the
// Review Queue in junk — so scheduled runs only keep real candidates.
export const MIN_HOURS_BETWEEN_RUNS = 20
export const MIN_MATCH_SCORE = 30
export const MAX_NEW_JOBS_PER_RUN = 25
export const MAX_USERS_PER_RUN = 25

export type ScheduledUser = { uid: string; profile: Profile }
export type NewJob = Omit<Job, "id">

export interface DiscoveryStore {
  listEnabledUsers(limit: number): Promise<ScheduledUser[]>
  getExistingJobs(uid: string): Promise<Job[]>
  saveJobs(uid: string, jobs: NewJob[]): Promise<Job[]>
  writeCaseFileEntries(uid: string, entries: CaseFileEntryDraft[]): Promise<void>
  recordRun(uid: string, patch: { lastRunAt?: string; lastRunSummary: string }): Promise<void>
}

export type Fetchers = Record<ScheduledSourceId, (profile: Profile) => Promise<DiscoveredJob[]>>
export type Reviewer = (jobs: JobInput[], profile: ProfileInput) => Promise<CaseFileEntryDraft[]>
// Sends the new-match email for one user's newly-saved Jobs; the
// implementation (app/api/cron/discover/route.ts) decides what "above 70"
// and the copy look like (lib/email/templates.ts) — this layer only knows
// whether to call it. Null when RESEND_API_KEY isn't configured, same
// nullable-when-unconfigured pattern as Reviewer.
export type Emailer = (to: string, jobs: Job[]) => Promise<void>

export type UserResult = {
  user: string
  status: "ran" | "skipped" | "error"
  saved: number
  reviewed: number
  notes: string[]
}

const normalize = (s: string) => s.trim().toLowerCase()

// A posting's identity for dedup: the source's own id when it has one
// (same rule as the manual flow), else company + title within the source.
function dedupeKey(job: { source: string; externalId?: string; company: string; title: string }): string {
  return job.externalId
    ? `${job.source}|id|${job.externalId}`
    : `${job.source}|ct|${normalize(job.company)}|${normalize(job.title)}`
}

// Pure: which discovered postings become new Jobs. Drops anything already
// stored (including ones the user dismissed — a dismissed Job stays in
// Firestore, so it never resurfaces), duplicates within the batch, and
// anything scoring below MIN_MATCH_SCORE; keeps the best MAX_NEW_JOBS_PER_RUN.
export function selectNewJobs(
  existing: Job[],
  discovered: DiscoveredJob[],
  profile: Profile,
  now: Date,
): NewJob[] {
  const seen = new Set(existing.map(dedupeKey))
  const selected: NewJob[] = []
  for (const posting of discovered) {
    const key = dedupeKey(posting)
    if (seen.has(key)) continue
    seen.add(key)

    const { score, reasons } = computeMatchScore(posting, profile)
    if (score < MIN_MATCH_SCORE) continue
    selected.push({
      ...posting,
      ownerId: "",
      dateDiscovered: now.toISOString(),
      matchScore: score,
      matchReasons: reasons,
      reviewStatus: "pending",
    })
  }
  return selected.sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0)).slice(0, MAX_NEW_JOBS_PER_RUN)
}

const isKnownSource = (s: unknown): s is ScheduledSourceId => SCHEDULED_SOURCES.some((k) => k.id === s)

const errorText = (err: unknown) => clip(err instanceof Error ? err.message : String(err), 200)

async function runForUser(
  deps: DiscoveryDeps,
  { uid, profile }: ScheduledUser,
  force: boolean,
): Promise<UserResult> {
  const result: UserResult = { user: uid.slice(0, 6), status: "ran", saved: 0, reviewed: 0, notes: [] }
  const settings = profile.scheduledDiscovery
  const sources = (settings?.sources ?? []).filter(isKnownSource)

  if (!settings?.enabled || sources.length === 0) {
    return { ...result, status: "skipped", notes: ["no sources enabled"] }
  }
  if (!force && settings.lastRunAt) {
    const hoursSince = (deps.now.getTime() - new Date(settings.lastRunAt).getTime()) / 3_600_000
    if (hoursSince < MIN_HOURS_BETWEEN_RUNS) {
      return { ...result, status: "skipped", notes: [`ran ${hoursSince.toFixed(1)}h ago`] }
    }
  }

  const existing = await deps.store.getExistingJobs(uid)

  const discovered: DiscoveredJob[] = []
  let anySourceWorked = false
  for (const source of sources) {
    try {
      discovered.push(...(await deps.fetchers[source](profile)))
      anySourceWorked = true
    } catch (err) {
      result.notes.push(`${source} failed: ${errorText(err)}`)
    }
  }

  const fresh = selectNewJobs(existing, discovered, profile, deps.now)
  const saved = fresh.length > 0 ? await deps.store.saveJobs(uid, fresh) : []
  result.saved = saved.length

  // Another bonus layer on real, already-saved Jobs — a failure never
  // undoes the save or blocks the agent review below.
  if (saved.length > 0 && deps.emailer && profile.notificationEmail) {
    try {
      await deps.emailer(profile.notificationEmail, saved)
    } catch (err) {
      result.notes.push(`new-match email failed: ${errorText(err)}`)
    }
  }

  // Agent commentary is a bonus layer on real, already-saved Jobs: a
  // failure here never undoes the save. It also needs target roles — with
  // none, every score is meaningless and there's nothing for Compass to say.
  if (saved.length > 0 && deps.reviewer && profile.targetRoles.length > 0) {
    const top = [...saved].sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0)).slice(0, MAX_JOBS_PER_REVIEW)
    try {
      const entries = await deps.reviewer(
        top.map((job) => buildReviewPayload(job, existing)),
        { targetRoles: profile.targetRoles.slice(0, 20).map((r) => clip(r, 200)) },
      )
      if (entries.length > 0) await deps.store.writeCaseFileEntries(uid, entries)
      result.reviewed = top.length
    } catch (err) {
      result.notes.push(`agent review failed: ${errorText(err)}`)
    }
  }

  const summary =
    saved.length > 0
      ? `Added ${saved.length} new match${saved.length === 1 ? "" : "es"}` +
        (result.reviewed > 0 ? `, reviewed the top ${result.reviewed}.` : ".")
      : anySourceWorked
        ? "No new matches."
        : "Couldn't reach any source."
  // Only stamp lastRunAt when a source actually answered, so a run where
  // every source failed is retried on the next tick instead of skipped.
  await deps.store.recordRun(uid, {
    ...(anySourceWorked ? { lastRunAt: deps.now.toISOString() } : {}),
    lastRunSummary: summary,
  })
  if (!anySourceWorked) result.status = "error"
  return result
}

export type DiscoveryDeps = {
  store: DiscoveryStore
  fetchers: Fetchers
  // null when no Anthropic key is configured: jobs are still saved, just
  // without commentary.
  reviewer: Reviewer | null
  // null when no RESEND_API_KEY is configured: jobs are still saved, just
  // without a notification.
  emailer: Emailer | null
  now: Date
}

export async function runScheduledDiscovery(
  deps: DiscoveryDeps,
  options: { force?: boolean } = {},
): Promise<{ users: UserResult[] }> {
  const users = await deps.store.listEnabledUsers(MAX_USERS_PER_RUN)
  const results: UserResult[] = []
  // Sequential on purpose: bounds load on the job APIs and on the model,
  // and one user's failure can't affect another's.
  for (const user of users) {
    try {
      results.push(await runForUser(deps, user, options.force ?? false))
    } catch (err) {
      results.push({ user: user.uid.slice(0, 6), status: "error", saved: 0, reviewed: 0, notes: [errorText(err)] })
    }
  }
  return { users: results }
}

import type { Firestore } from "firebase-admin/firestore"

// Review-queue hygiene: a posting sitting in the pending queue for weeks,
// or whose own link now 404s, is clutter nobody's going to act on. Runs
// once per day inside the same /api/cron/discover invocation rather than
// a third Vercel Cron job (this project deliberately caps at 2 — see
// JOURNEY.md), across EVERY owner's jobs in one query, independent of
// whether that owner opted into the daily auto-pull above
// (lib/server/scheduled-discovery.ts) — hygiene shouldn't depend on an
// unrelated opt-in.
//
// Reads once with a single-field equality filter (reviewStatus == pending
// — no composite index needed) and does the date comparisons in memory:
// ISO date strings compare correctly with plain string operators, the
// same trick lib/notifications/follow-ups.ts already relies on.

export const STALE_AFTER_DAYS = 21
export const LINK_CHECK_MIN_AGE_DAYS = 3
export const MAX_LINK_CHECKS_PER_RUN = 25
export const LINK_CHECK_TIMEOUT_MS = 6000

const BATCH_SIZE = 400 // Firestore's limit is 500 writes per batch

async function batchArchive(db: Firestore, refs: FirebaseFirestore.DocumentReference[]): Promise<void> {
  for (let i = 0; i < refs.length; i += BATCH_SIZE) {
    const batch = db.batch()
    for (const ref of refs.slice(i, i + BATCH_SIZE)) batch.update(ref, { reviewStatus: "archived" })
    await batch.commit()
  }
}

// Only an explicit 404/410 counts as "the posting is gone." Anything else
// — timeout, network error, a 403 from anti-bot protection, a flaky 500 —
// is left alone: a false "archived" would silently hide a real
// opportunity with no way for the user to notice, while a missed dead
// link just sits one more day until the stale-age sweep above catches it
// anyway.
async function isConfirmedDead(url: string): Promise<boolean> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), LINK_CHECK_TIMEOUT_MS)
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "follow", signal: controller.signal })
    return res.status === 404 || res.status === 410
  } catch {
    return false
  } finally {
    clearTimeout(timeout)
  }
}

export type ArchiveResult = {
  staleArchived: number
  deadLinksChecked: number
  deadLinkArchived: number
}

export async function archiveStaleAndDeadJobs(db: Firestore, now: Date): Promise<ArchiveResult> {
  const snap = await db.collection("jobs").where("reviewStatus", "==", "pending").get()
  const staleCutoff = new Date(now.getTime() - STALE_AFTER_DAYS * 86_400_000).toISOString()
  const linkCheckCutoff = new Date(now.getTime() - LINK_CHECK_MIN_AGE_DAYS * 86_400_000).toISOString()

  const stale = snap.docs.filter((d) => (d.data().dateDiscovered as string) <= staleCutoff)
  await batchArchive(db, stale.map((d) => d.ref))

  // Dead-link checks are capped and run in parallel (not against the
  // oldest-first stale batch above, which is already being archived by
  // age) so the wall-clock cost stays close to one LINK_CHECK_TIMEOUT_MS
  // window regardless of how many candidates there are — this runs inside
  // the same maxDuration=60s route as the rest of daily discovery, so a
  // sequential loop of up to 25 six-second timeouts would risk the exact
  // truncation failure already hit twice before (JOURNEY.md §24, §26).
  const staleIds = new Set(stale.map((d) => d.id))
  const linkCandidates = snap.docs
    .filter((d) => !staleIds.has(d.id) && d.data().postingUrl && (d.data().dateDiscovered as string) <= linkCheckCutoff)
    .sort((a, b) => (a.data().dateDiscovered as string).localeCompare(b.data().dateDiscovered as string))
    .slice(0, MAX_LINK_CHECKS_PER_RUN)

  const deadResults = await Promise.all(linkCandidates.map((d) => isConfirmedDead(d.data().postingUrl as string)))
  const deadDocs = linkCandidates.filter((_, i) => deadResults[i])
  await batchArchive(db, deadDocs.map((d) => d.ref))

  return { staleArchived: stale.length, deadLinksChecked: linkCandidates.length, deadLinkArchived: deadDocs.length }
}

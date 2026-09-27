import { collection, doc, getDocs, onSnapshot, query, updateDoc, where, writeBatch } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { DiscoveredJob } from "@/lib/discovery/types"
import { computeMatchScore } from "@/lib/matching/score"
import type { Job, Profile } from "@/lib/types"

export function subscribeToJobs(ownerId: string, onChange: (jobs: Job[]) => void) {
  const q = query(collection(db, "jobs"), where("ownerId", "==", ownerId))
  return onSnapshot(q, (snapshot) => {
    onChange(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Job))
  })
}

export type SaveDiscoveredJobsResult = {
  savedJobs: Job[]
  // The pre-existing set, for callers that need to check newly-saved
  // postings against what was already there (e.g. concern-signal
  // detection) without a second Firestore round trip.
  existingJobs: Job[]
}

// Writes only the postings not already seen from this source (matched by
// the source's own externalId — spec Section 7, Scout "dedupes against
// existing Jobs"), scoring each one against the Profile as it's saved.
// A single batch: Arbeitnow returns 250 postings/page, well under
// Firestore's 500-write batch limit.
export async function saveDiscoveredJobs(
  ownerId: string,
  discovered: DiscoveredJob[],
  profile: Profile,
): Promise<SaveDiscoveredJobsResult> {
  const existingSnap = await getDocs(query(collection(db, "jobs"), where("ownerId", "==", ownerId)))
  const existingJobs = existingSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Job)
  const seenExternalIds = new Set(
    existingJobs.filter((j) => j.source === discovered[0]?.source).map((j) => j.externalId),
  )

  const newPostings = discovered.filter((p) => !p.externalId || !seenExternalIds.has(p.externalId))
  if (newPostings.length === 0) return { savedJobs: [], existingJobs }

  const batch = writeBatch(db)
  const now = new Date().toISOString()
  const savedJobs: Job[] = []
  for (const posting of newPostings) {
    const { score, reasons } = computeMatchScore(posting, profile)
    const ref = doc(collection(db, "jobs"))
    const jobData = {
      ...posting,
      ownerId,
      dateDiscovered: now,
      matchScore: score,
      matchReasons: reasons,
      // Opt-in auto-dismiss (Profile.autoDismissBelow, unset by default):
      // a posting still gets saved either way — dedup depends on every
      // past posting staying in Firestore, dismissed or not — it's only
      // reviewStatus that changes, so it never surfaces in the queue.
      reviewStatus: (profile.autoDismissBelow != null && score < profile.autoDismissBelow
        ? "dismissed"
        : "pending") as "dismissed" | "pending",
    }
    batch.set(ref, jobData)
    savedJobs.push({ id: ref.id, ...jobData })
  }
  await batch.commit()
  return { savedJobs, existingJobs }
}

export async function dismissJob(jobId: string) {
  await updateDoc(doc(db, "jobs", jobId), { reviewStatus: "dismissed" })
}

// Firestore's write-batch limit is 500 operations; chunked the same way
// admin-store.ts chunks scheduled-discovery saves, for the same reason —
// a big enough "Dismiss lowest match %" sweep could exceed one batch.
const BATCH_SIZE = 400

export async function dismissJobs(jobIds: string[]) {
  for (let i = 0; i < jobIds.length; i += BATCH_SIZE) {
    const batch = writeBatch(db)
    for (const jobId of jobIds.slice(i, i + BATCH_SIZE)) {
      batch.update(doc(db, "jobs", jobId), { reviewStatus: "dismissed" })
    }
    await batch.commit()
  }
}

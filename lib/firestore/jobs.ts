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
  // savedJobs[i] corresponds to savedDiscovered[i] — returned as aligned
  // pairs rather than making the caller re-derive that alignment (e.g. by
  // re-filtering the original list), which is an easy place to introduce
  // an off-by-one mismatch.
  savedJobs: Job[]
  savedDiscovered: DiscoveredJob[]
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
  if (newPostings.length === 0) return { savedJobs: [], savedDiscovered: [], existingJobs }

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
      reviewStatus: "pending" as const,
    }
    batch.set(ref, jobData)
    savedJobs.push({ id: ref.id, ...jobData })
  }
  await batch.commit()
  return { savedJobs, savedDiscovered: newPostings, existingJobs }
}

export async function dismissJob(jobId: string) {
  await updateDoc(doc(db, "jobs", jobId), { reviewStatus: "dismissed" })
}

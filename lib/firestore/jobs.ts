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

// Writes only the postings not already seen from this source (matched by
// the source's own externalId — spec Section 7, Scout "dedupes against
// existing Jobs"), scoring each one against the Profile as it's saved.
// A single batch: Arbeitnow returns 250 postings/page, well under
// Firestore's 500-write batch limit.
export async function saveDiscoveredJobs(
  ownerId: string,
  discovered: DiscoveredJob[],
  profile: Profile,
): Promise<number> {
  const existingSnap = await getDocs(query(collection(db, "jobs"), where("ownerId", "==", ownerId)))
  const seenExternalIds = new Set(
    existingSnap.docs
      .map((d) => d.data() as Job)
      .filter((j) => j.source === discovered[0]?.source)
      .map((j) => j.externalId),
  )

  const newPostings = discovered.filter((p) => !p.externalId || !seenExternalIds.has(p.externalId))
  if (newPostings.length === 0) return 0

  const batch = writeBatch(db)
  const now = new Date().toISOString()
  for (const posting of newPostings) {
    const { score, reasons } = computeMatchScore(posting, profile)
    const ref = doc(collection(db, "jobs"))
    batch.set(ref, {
      ...posting,
      ownerId,
      dateDiscovered: now,
      matchScore: score,
      matchReasons: reasons,
      reviewStatus: "pending",
    })
  }
  await batch.commit()
  return newPostings.length
}

export async function dismissJob(jobId: string) {
  await updateDoc(doc(db, "jobs", jobId), { reviewStatus: "dismissed" })
}

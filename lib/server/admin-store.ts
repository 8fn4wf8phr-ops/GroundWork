import type { Firestore } from "firebase-admin/firestore"
import type { CaseFileEntryDraft } from "@/lib/server/review-jobs"
import type { DiscoveryStore, NewJob, ScheduledUser } from "@/lib/server/scheduled-discovery"
import type { Job, Profile } from "@/lib/types"

// DiscoveryStore on the Firebase Admin SDK. Admin access ignores security
// rules, so the ownership guarantee the rules give the browser has to be
// re-created here by hand: every read and write below is keyed to a uid
// that came from a Profile document's own id (profiles are uid-keyed), and
// every created document is stamped with that same ownerId.
const BATCH_SIZE = 400 // Firestore's limit is 500 writes per batch

export function createAdminStore(db: Firestore): DiscoveryStore {
  return {
    async listEnabledUsers(limit) {
      const snap = await db.collection("profiles").where("scheduledDiscovery.enabled", "==", true).limit(limit).get()
      return snap.docs.map((d): ScheduledUser => {
        const data = d.data() as Partial<Profile>
        return {
          uid: d.id,
          profile: {
            ...(data as Profile),
            ownerId: d.id,
            targetRoles: data.targetRoles ?? [],
            locations: data.locations ?? [],
            mustHaves: data.mustHaves ?? [],
            dealBreakers: data.dealBreakers ?? [],
          },
        }
      })
    },

    async getExistingJobs(uid) {
      const snap = await db.collection("jobs").where("ownerId", "==", uid).get()
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Job)
    },

    async saveJobs(uid, jobs: NewJob[]) {
      const saved: Job[] = []
      for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
        const batch = db.batch()
        for (const job of jobs.slice(i, i + BATCH_SIZE)) {
          const ref = db.collection("jobs").doc()
          const data = { ...job, ownerId: uid }
          batch.set(ref, data)
          saved.push({ id: ref.id, ...data })
        }
        await batch.commit()
      }
      return saved
    },

    async writeCaseFileEntries(uid, entries: CaseFileEntryDraft[]) {
      const batch = db.batch()
      const now = new Date().toISOString()
      for (const entry of entries) {
        batch.set(db.collection("caseFileEntries").doc(), { ...entry, ownerId: uid, createdAt: now })
      }
      await batch.commit()
    },

    async recordRun(uid, patch) {
      // merge:true deep-merges the map, leaving `enabled` and `sources` (the
      // user's own settings) untouched.
      await db.collection("profiles").doc(uid).set({ scheduledDiscovery: patch }, { merge: true })
    },
  }
}

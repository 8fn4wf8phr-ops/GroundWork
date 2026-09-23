import { deleteField, doc, onSnapshot, setDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { sanitizeForFirestore } from "@/lib/firestore/sanitize"
import type { Profile, ScheduledSourceId } from "@/lib/types"

// Profile is a singleton per user, so it's keyed by uid directly rather
// than living in a queried collection — there's no "which one" to ask.
export function subscribeToProfile(ownerId: string, onChange: (profile: Profile | null) => void) {
  return onSnapshot(doc(db, "profiles", ownerId), (snapshot) => {
    onChange(snapshot.exists() ? (snapshot.data() as Profile) : null)
  })
}

// The form owns every field here *except* scheduledDiscovery, which has
// its own toggle and is also written by the daily cron (lastRunAt etc.).
// So this merges instead of replacing the document — a plain setDoc would
// wipe those settings on every Profile save. The catch with merge: a field
// the user cleared (undefined, which sanitize drops) would linger from the
// old document, so the optional fields are deleted explicitly.
export async function saveProfile(
  ownerId: string,
  profile: Omit<Profile, "ownerId" | "updatedAt" | "scheduledDiscovery">,
) {
  const { phone, salaryFloor, ...rest } = profile
  await setDoc(
    doc(db, "profiles", ownerId),
    {
      ...sanitizeForFirestore(rest),
      phone: phone ?? deleteField(),
      salaryFloor: salaryFloor ?? deleteField(),
      ownerId,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  )
}

// Merges only enabled/sources into the settings map, so the cron's
// lastRunAt / lastRunSummary survive a toggle. Callers must only use this
// once a Profile exists (a merge onto a missing document would create a
// stub with no name/roles).
export async function saveScheduledDiscovery(
  ownerId: string,
  settings: { enabled: boolean; sources: ScheduledSourceId[] },
) {
  await setDoc(doc(db, "profiles", ownerId), { scheduledDiscovery: settings }, { merge: true })
}

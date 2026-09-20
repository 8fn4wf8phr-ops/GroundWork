import { doc, onSnapshot, setDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { sanitizeForFirestore } from "@/lib/firestore/sanitize"
import type { Profile } from "@/lib/types"

// Profile is a singleton per user, so it's keyed by uid directly rather
// than living in a queried collection — there's no "which one" to ask.
export function subscribeToProfile(ownerId: string, onChange: (profile: Profile | null) => void) {
  return onSnapshot(doc(db, "profiles", ownerId), (snapshot) => {
    onChange(snapshot.exists() ? (snapshot.data() as Profile) : null)
  })
}

export async function saveProfile(ownerId: string, profile: Omit<Profile, "ownerId" | "updatedAt">) {
  await setDoc(doc(db, "profiles", ownerId), {
    ...sanitizeForFirestore(profile),
    ownerId,
    updatedAt: new Date().toISOString(),
  })
}

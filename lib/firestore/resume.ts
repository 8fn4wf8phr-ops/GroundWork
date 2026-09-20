import { doc, onSnapshot, setDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { sanitizeForFirestore } from "@/lib/firestore/sanitize"
import type { Resume } from "@/lib/types"

// Resume is a singleton per user, keyed by uid directly — same pattern as
// Profile (lib/firestore/profile.ts).
export function subscribeToResume(ownerId: string, onChange: (resume: Resume | null) => void) {
  return onSnapshot(doc(db, "resumes", ownerId), (snapshot) => {
    onChange(snapshot.exists() ? (snapshot.data() as Resume) : null)
  })
}

export async function saveResume(ownerId: string, resume: Omit<Resume, "ownerId" | "updatedAt">) {
  await setDoc(doc(db, "resumes", ownerId), {
    ...sanitizeForFirestore(resume),
    ownerId,
    updatedAt: new Date().toISOString(),
  })
}

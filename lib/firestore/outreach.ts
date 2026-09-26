import { addDoc, collection, deleteDoc, doc, onSnapshot, query, updateDoc, where } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { sanitizeForFirestore } from "@/lib/firestore/sanitize"
import type { Outreach } from "@/lib/types"

// One ownerId equality filter, same as jobs/applications/contacts — the
// UI derives per-contact views client-side (see use-outreach.ts) rather
// than querying per contactId, matching the "one broad subscription"
// pattern useApplications/useReviewQueue already use.
export function subscribeToOutreach(ownerId: string, onChange: (outreach: Outreach[]) => void) {
  const q = query(collection(db, "outreach"), where("ownerId", "==", ownerId))
  return onSnapshot(q, (snapshot) => {
    onChange(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Outreach))
  })
}

export type NewOutreach = Omit<Outreach, "id" | "ownerId" | "createdAt" | "updatedAt">

export async function createOutreach(ownerId: string, input: NewOutreach): Promise<string> {
  const now = new Date().toISOString()
  const ref = await addDoc(collection(db, "outreach"), {
    ...sanitizeForFirestore(input),
    ownerId,
    createdAt: now,
    updatedAt: now,
  })
  return ref.id
}

export async function updateOutreach(outreachId: string, updates: Partial<NewOutreach>) {
  await updateDoc(doc(db, "outreach", outreachId), {
    ...sanitizeForFirestore(updates),
    updatedAt: new Date().toISOString(),
  })
}

export async function deleteOutreach(outreachId: string) {
  await deleteDoc(doc(db, "outreach", outreachId))
}

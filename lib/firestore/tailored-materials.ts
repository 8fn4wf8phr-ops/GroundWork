import { addDoc, collection, doc, getDocs, query, updateDoc, where } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { sanitizeForFirestore } from "@/lib/firestore/sanitize"
import type { TailoredMaterials } from "@/lib/types"

// Always accessed by query (ownerId + applicationId), never a direct
// get-by-id on a possibly-nonexistent doc — see firestore.rules for why.
export async function getTailoredMaterials(
  ownerId: string,
  applicationId: string,
): Promise<TailoredMaterials | null> {
  const snap = await getDocs(
    query(
      collection(db, "tailoredMaterials"),
      where("ownerId", "==", ownerId),
      where("applicationId", "==", applicationId),
    ),
  )
  if (snap.empty) return null
  const d = snap.docs[0]
  return { id: d.id, ...d.data() } as TailoredMaterials
}

export type NewTailoredMaterials = Omit<TailoredMaterials, "id" | "ownerId" | "generatedAt">

// One TailoredMaterials per Application — "regenerate" overwrites the
// existing doc (updates it) rather than creating a version history,
// matching the "staged, current version" framing rather than an archive.
export async function saveTailoredMaterials(ownerId: string, materials: NewTailoredMaterials) {
  const existing = await getTailoredMaterials(ownerId, materials.applicationId)
  const payload = { ...sanitizeForFirestore(materials), ownerId, generatedAt: new Date().toISOString() }
  if (existing) {
    await updateDoc(doc(db, "tailoredMaterials", existing.id), payload)
    return existing.id
  }
  const ref = await addDoc(collection(db, "tailoredMaterials"), payload)
  return ref.id
}

export async function saveEditedCoverLetter(materialsId: string, editedCoverLetter: string) {
  await updateDoc(doc(db, "tailoredMaterials", materialsId), { editedCoverLetter })
}

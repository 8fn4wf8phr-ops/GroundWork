import { collection, doc, onSnapshot, query, updateDoc, where, writeBatch } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { sanitizeForFirestore } from "@/lib/firestore/sanitize"
import type { CaseFileEntry } from "@/lib/types"

// A single equality filter (ownerId) is covered by Firestore's automatic
// single-field indexes; adding orderBy on a different field (createdAt)
// would require a composite index the user would have to create manually
// in the console. Sorting client-side avoids that extra setup step —
// case file volume per user is small enough that this is cheap.
export function subscribeToCaseFile(ownerId: string, onChange: (entries: CaseFileEntry[]) => void) {
  const q = query(collection(db, "caseFileEntries"), where("ownerId", "==", ownerId))
  return onSnapshot(q, (snapshot) => {
    const entries = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as CaseFileEntry)
    entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    onChange(entries)
  })
}

export type NewCaseFileEntry = Omit<CaseFileEntry, "id" | "ownerId" | "createdAt">

// Written as a batch — a disagreement produces 2-3 entries (Compass's
// take, Scout's pushback, Compass's response) that should land together,
// not interleaved with entries from something else happening at the same
// moment.
export async function createCaseFileEntries(ownerId: string, entries: NewCaseFileEntry[]) {
  const batch = writeBatch(db)
  const now = new Date().toISOString()
  for (const entry of entries) {
    const ref = doc(collection(db, "caseFileEntries"))
    batch.set(ref, { ...sanitizeForFirestore(entry), ownerId, createdAt: now })
  }
  await batch.commit()
}

export async function resolveCaseFileEntry(entryId: string, resolution: string) {
  await updateDoc(doc(db, "caseFileEntries", entryId), {
    resolvedAt: new Date().toISOString(),
    resolution,
  })
}

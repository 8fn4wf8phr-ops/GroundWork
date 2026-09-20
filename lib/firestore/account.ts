import { collection, deleteDoc, doc, getDocs, query, where, writeBatch } from "firebase/firestore"
import { deleteUser, type User } from "firebase/auth"
import { db } from "@/lib/firebase"

const BATCH_LIMIT = 500

async function deleteAllOwnedDocs(collectionName: string, ownerId: string) {
  const snap = await getDocs(query(collection(db, collectionName), where("ownerId", "==", ownerId)))
  const docs = snap.docs
  // Firestore batches cap at 500 writes — chunk in case a heavy user ever
  // crosses that, even though it's unlikely at this app's scale.
  for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db)
    for (const d of docs.slice(i, i + BATCH_LIMIT)) {
      batch.delete(d.ref)
    }
    await batch.commit()
  }
}

// Spec §5 — "a real delete everything action... an actual way to leave,
// not a soft deactivation flag." Removes every Firestore document tied to
// the account, then deletes the Firebase Auth user itself so there's
// nothing left to sign back into — not just a data wipe on a still-live
// account.
export async function deleteAccount(user: User) {
  const ownerId = user.uid
  await Promise.all([
    deleteAllOwnedDocs("jobs", ownerId),
    deleteAllOwnedDocs("applications", ownerId),
    deleteAllOwnedDocs("contacts", ownerId),
  ])
  // Profile/Resume are singletons keyed by uid — deleteDoc on a
  // non-existent doc is a no-op, so this is safe even if one was never
  // created.
  await Promise.all([deleteDoc(doc(db, "profiles", ownerId)), deleteDoc(doc(db, "resumes", ownerId))])
  // Must run last: deleting the Auth user signs them out immediately, and
  // Firestore rules require a matching auth token for the deletes above.
  await deleteUser(user)
}

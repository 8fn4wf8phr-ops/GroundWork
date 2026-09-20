import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import { sanitizeForFirestore } from "@/lib/firestore/sanitize"
import type { Contact } from "@/lib/types"

export function subscribeToContacts(ownerId: string, onChange: (contacts: Contact[]) => void) {
  const q = query(collection(db, "contacts"), where("ownerId", "==", ownerId))
  return onSnapshot(q, (snapshot) => {
    onChange(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Contact))
  })
}

export type ContactInput = {
  name: string
  role?: string
  email?: string
  phone?: string
}

export async function createContact(ownerId: string, input: ContactInput) {
  const ref = await addDoc(collection(db, "contacts"), {
    ownerId,
    name: input.name,
    role: input.role || null,
    email: input.email || null,
    phone: input.phone || null,
    applicationIds: [],
  })
  return ref.id
}

export async function updateContact(contactId: string, updates: Partial<ContactInput>) {
  await updateDoc(doc(db, "contacts", contactId), sanitizeForFirestore(updates) as Partial<Contact>)
}

export async function deleteContact(contactId: string) {
  await deleteDoc(doc(db, "contacts", contactId))
}

export async function linkContactToApplication(contactId: string, applicationId: string) {
  await updateDoc(doc(db, "contacts", contactId), { applicationIds: arrayUnion(applicationId) })
}

export async function unlinkContactFromApplication(contactId: string, applicationId: string) {
  await updateDoc(doc(db, "contacts", contactId), { applicationIds: arrayRemove(applicationId) })
}

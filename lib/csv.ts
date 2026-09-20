import { collection, getDocs, query, where } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { ApplicationWithJob, Contact } from "@/lib/types"

const CSV_HEADERS = [
  "Company",
  "Title",
  "Location",
  "Status",
  "Channel",
  "Applied date",
  "Follow-up date",
  "Rejection reason",
  "Notes",
  "Contacts",
  "Posting URL",
  "Source",
]

function escapeCsvField(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

function applicationsToCsv(applications: ApplicationWithJob[], contacts: Contact[]): string {
  const rows = applications.map((app) => {
    const linkedContacts = contacts
      .filter((c) => c.applicationIds.includes(app.id))
      .map((c) => c.name)
      .join("; ")
    return [
      app.job?.company ?? "",
      app.job?.title ?? "",
      app.job?.location ?? "",
      app.status,
      app.channel ?? "",
      app.appliedDate ?? "",
      app.followUpDate ?? "",
      app.rejectionReason ?? "",
      app.notes ?? "",
      linkedContacts,
      app.job?.postingUrl ?? "",
      app.job?.source ?? "",
    ]
  })
  return [CSV_HEADERS, ...rows].map((row) => row.map((v) => escapeCsvField(String(v))).join(",")).join("\r\n")
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// A one-shot getDocs rather than a live subscription — export is a single
// point-in-time action, not something that needs to stay in sync with the
// dashboard's already-live Applications data.
export async function exportApplicationsCsv(ownerId: string, applications: ApplicationWithJob[]) {
  const contactsSnap = await getDocs(query(collection(db, "contacts"), where("ownerId", "==", ownerId)))
  const contacts = contactsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Contact)
  const csv = applicationsToCsv(applications, contacts)
  downloadCsv(`groundwork-applications-${new Date().toISOString().slice(0, 10)}.csv`, csv)
}

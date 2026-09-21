import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import { sanitizeForFirestore } from "@/lib/firestore/sanitize"
import type { Application, ApplicationStatus, Channel, Job, JobSource } from "@/lib/types"

export function subscribeToApplications(
  ownerId: string,
  onChange: (applications: Application[]) => void,
) {
  const q = query(collection(db, "applications"), where("ownerId", "==", ownerId))
  return onSnapshot(q, (snapshot) => {
    onChange(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Application))
  })
}

export type ManualApplicationInput = {
  company: string
  title: string
  location: string
  postingUrl?: string
  status: ApplicationStatus
  channel?: Channel
  notes?: string
}

// Spec Section 6 — before creating, check for an existing Application at
// the same company with the same/similar title in the last 90 days. This
// is a plain case-insensitive equality check, not fuzzy matching — good
// enough to catch the common case (re-adding the same posting) without
// pulling in a similarity library for what's still a Phase 1 feature.
export async function findPossibleDuplicate(
  ownerId: string,
  company: string,
  title: string,
): Promise<{ company: string; title: string; appliedDate?: string } | null> {
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

  const jobsSnap = await getDocs(query(collection(db, "jobs"), where("ownerId", "==", ownerId)))
  const jobs = jobsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Job)
  const normalize = (s: string) => s.trim().toLowerCase()
  const matchingJobIds = new Set(
    jobs
      .filter((j) => normalize(j.company) === normalize(company) && normalize(j.title) === normalize(title))
      .map((j) => j.id),
  )
  if (matchingJobIds.size === 0) return null

  const appsSnap = await getDocs(
    query(collection(db, "applications"), where("ownerId", "==", ownerId)),
  )
  for (const appDoc of appsSnap.docs) {
    const app = appDoc.data() as Omit<Application, "id">
    if (!matchingJobIds.has(app.jobId)) continue
    const createdAt = new Date(app.createdAt)
    if (createdAt >= ninetyDaysAgo) {
      return { company, title, appliedDate: app.appliedDate }
    }
  }
  return null
}

// Writes the Job and its Application in one batch — a manually-added
// posting has no separate "discovery" step, so both documents are
// created together with Job.source = "manual" (spec Section 11).
export async function createManualApplication(ownerId: string, input: ManualApplicationInput) {
  const batch = writeBatch(db)
  const jobRef = doc(collection(db, "jobs"))
  const applicationRef = doc(collection(db, "applications"))
  const now = new Date().toISOString()

  batch.set(jobRef, {
    ownerId,
    title: input.title,
    company: input.company,
    location: input.location,
    source: "manual",
    postingUrl: input.postingUrl || null,
    dateDiscovered: now,
  })

  batch.set(applicationRef, {
    ownerId,
    jobId: jobRef.id,
    status: input.status,
    channel: input.channel || null,
    notes: input.notes || null,
    appliedDate: input.status === "Applied" ? now.slice(0, 10) : null,
    createdAt: now,
  })

  await batch.commit()
  return { jobId: jobRef.id, applicationId: applicationRef.id }
}

export type ApplicationEditableFields = Pick<
  Application,
  | "status"
  | "channel"
  | "appliedDate"
  | "followUpDate"
  | "rejectionReason"
  | "notes"
  | "resumeVersionUsed"
  | "coverLetterUsed"
>

// updateDoc rejects `undefined` field values outright (it throws, it
// doesn't just ignore them), so both "" and undefined — however the caller
// spells "this field is cleared" — are normalized to `null` before the
// write.
export async function updateApplication(
  applicationId: string,
  updates: Partial<ApplicationEditableFields>,
) {
  // Firestore's UpdateData<T> type can't express "a subset of fields with
  // string keys built at runtime" — sanitizeForFirestore already
  // guarantees these are valid Application field values.
  await updateDoc(doc(db, "applications", applicationId), sanitizeForFirestore(updates) as Partial<Application>)
}

// A manually-added Job is created 1:1 with its Application (see
// createManualApplication) and has no life of its own, so deleting the
// Application deletes the Job too. A discovered Job (Arbeitnow, etc.) is
// real independent data — deleting the Application it turned into
// shouldn't erase the discovery record or its match score.
export async function deleteApplication(applicationId: string, jobId: string, jobSource: JobSource) {
  const batch = writeBatch(db)
  batch.delete(doc(db, "applications", applicationId))
  if (jobSource === "manual") {
    batch.delete(doc(db, "jobs", jobId))
  }
  await batch.commit()
}

// The "Pursue" action from the Review Queue — turns a discovered Job into
// a tracked Application. The Job document is untouched; it simply stops
// matching the "pending, no Application yet" query once this exists.
export async function createApplicationFromJob(ownerId: string, jobId: string) {
  const ref = doc(collection(db, "applications"))
  await setDoc(ref, {
    ownerId,
    jobId,
    status: "Found",
    createdAt: new Date().toISOString(),
  })
  return ref.id
}

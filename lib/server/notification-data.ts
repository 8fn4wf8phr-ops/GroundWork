import type { Firestore } from "firebase-admin/firestore"
import type { Application, ApplicationWithJob, Job } from "@/lib/types"

// Admin-SDK reads for the notifications cron (app/api/cron/notifications).
// Admin access bypasses Firestore security rules, so every query here is
// scoped by uid by hand — same discipline as lib/server/admin-store.ts.

export type NotifyUser = { uid: string; notificationEmail: string }

export async function listUsersWithNotificationEmail(db: Firestore): Promise<NotifyUser[]> {
  const snap = await db.collection("profiles").where("notificationEmail", "!=", null).get()
  return snap.docs
    .map((d) => ({ uid: d.id, notificationEmail: d.data().notificationEmail as string | undefined }))
    .filter((u): u is NotifyUser => Boolean(u.notificationEmail))
}

// Same two-query-then-join-in-memory shape as the client SDK's
// useApplications (lib/hooks/use-applications.ts) — one ownerId equality
// filter per collection, no composite index required.
export async function getApplicationsWithJobs(db: Firestore, uid: string): Promise<ApplicationWithJob[]> {
  const [appsSnap, jobsSnap] = await Promise.all([
    db.collection("applications").where("ownerId", "==", uid).get(),
    db.collection("jobs").where("ownerId", "==", uid).get(),
  ])
  const jobsById = new Map(jobsSnap.docs.map((d) => [d.id, { id: d.id, ...d.data() } as Job]))
  return appsSnap.docs.map((d) => {
    const app = { id: d.id, ...d.data() } as Application
    return { ...app, job: jobsById.get(app.jobId) }
  })
}

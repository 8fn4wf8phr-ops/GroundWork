// Data model per groundwork-spec.md Section 4.
// Every document carries ownerId; Firestore rules (see firestore.rules)
// deny all reads/writes unless request.auth.uid matches it.

export type ApplicationStatus =
  | "Found"
  | "Reviewed"
  | "Applied"
  | "Response"
  | "Interview"
  | "Offer"
  | "Rejected"
  | "Withdrawn"

export const APPLICATION_STATUSES: ApplicationStatus[] = [
  "Found",
  "Reviewed",
  "Applied",
  "Response",
  "Interview",
  "Offer",
  "Rejected",
  "Withdrawn",
]

export type Channel = "cold" | "referral" | "recruiter outreach"

export const CHANNELS: Channel[] = ["cold", "referral", "recruiter outreach"]

export type JobSource =
  | "adzuna"
  | "usajobs"
  | "remoteok"
  | "weworkremotely"
  | "arbeitnow"
  | "themuse"
  | "jobicy"
  | "manual"

export type Job = {
  id: string
  ownerId: string
  title: string
  company: string
  location: string
  remote?: boolean
  source: JobSource
  // The source API's own id for this posting (e.g. Arbeitnow's slug) —
  // lets re-pulling the same source skip postings already seen, without
  // relying on company+title matching (spec Section 7: Scout "dedupes
  // against existing Jobs").
  externalId?: string
  tags?: string[]
  postingUrl?: string
  datePosted?: string
  dateDiscovered: string
  description?: string
  matchScore?: number
  matchReasons?: string[]
  // Review queue state for a discovered (non-manual) Job that has no
  // Application yet. Undefined/"pending" = awaiting a pursue/dismiss
  // decision; "dismissed" = filed away, per the Section 2 narrative.
  // Once the user pursues a Job, an Application is created and the Job
  // simply stops appearing in the pending query — no third state needed.
  reviewStatus?: "pending" | "dismissed"
}

export type Application = {
  id: string
  ownerId: string
  jobId: string
  status: ApplicationStatus
  appliedDate?: string
  resumeVersionUsed?: string
  coverLetterUsed?: string
  channel?: Channel
  rejectionReason?: string
  followUpDate?: string
  notes?: string
  createdAt: string
}

// One per user, keyed by the Firebase Auth uid (not a generated id) — the
// spec is explicit that this is a singleton per owner, not a collection.
export type Profile = {
  ownerId: string
  name: string
  email: string
  phone?: string
  targetRoles: string[]
  locations: string[]
  salaryFloor?: number
  mustHaves: string[]
  dealBreakers: string[]
  updatedAt: string
}

export type Contact = {
  id: string
  ownerId: string
  name: string
  role?: string
  email?: string
  phone?: string
  applicationIds: string[]
}

// A joined view for the dashboard — an Application with its Job data
// attached, since the board renders on company/title, not raw IDs.
export type ApplicationWithJob = Application & { job: Job | undefined }

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
// Opt-in settings for the daily scheduled discovery (see
// lib/server/scheduled-discovery.ts). Lives on the Profile document so it
// needs no new Firestore rules; the cron writes lastRunAt/lastRunSummary
// back with the Admin SDK. Only the sources listed here are pulled.
export type ScheduledSourceId = "adzuna" | "arbeitnow" | "remoteok" | "jobicy" | "themuse"

export const SCHEDULED_SOURCES: { id: ScheduledSourceId; label: string }[] = [
  { id: "adzuna", label: "Adzuna" },
  { id: "arbeitnow", label: "Arbeitnow" },
  { id: "remoteok", label: "RemoteOK" },
  { id: "jobicy", label: "Jobicy" },
  { id: "themuse", label: "The Muse" },
]

export type ScheduledDiscoverySettings = {
  enabled: boolean
  sources: ScheduledSourceId[]
  lastRunAt?: string
  lastRunSummary?: string
}

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
  scheduledDiscovery?: ScheduledDiscoverySettings
  updatedAt: string
}

// Resume is structured, not a raw file (spec §4) — experience bullets are
// stored individually so tailoring can later select/reorder/emphasize
// specific ones per job rather than rewriting the whole entry. Sub-entries
// carry a client-generated `id` (crypto.randomUUID()) purely for React
// keys and add/remove — they're array items inside one Resume document,
// not separate Firestore documents.
export type ExperienceEntry = {
  id: string
  company: string
  title: string
  startDate: string
  endDate?: string
  current: boolean
  bullets: string[]
}

export type EducationEntry = {
  id: string
  school: string
  degree: string
  field?: string
  startDate?: string
  endDate?: string
}

export type CertificationEntry = {
  id: string
  name: string
  issuer?: string
  date?: string
}

// Spec §16 — the project bank Quill draws from when tailoring: 1-2 most
// relevant projects per job, the same way it'll select resume bullets.
// `sourceId` is set only on projects imported from a portfolio's
// projects.json (spec §16) — a stable key (derived from the source
// entry's link/name) so re-syncing updates the same entry instead of
// duplicating it. Manually-added projects leave it unset.
export type ProjectEntry = {
  id: string
  name: string
  description: string
  skills: string[]
  link?: string
  repoLink?: string
  sourceId?: string
}

// One per user, keyed by uid — same singleton pattern as Profile.
export type Resume = {
  ownerId: string
  summary: string
  experience: ExperienceEntry[]
  skills: string[]
  education: EducationEntry[]
  certifications: CertificationEntry[]
  projects: ProjectEntry[]
  // Spec §16 — the portfolio site's own base URL; projects.json is
  // fetched from `${portfolioUrl}/projects.json`.
  portfolioUrl?: string
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

// Spec §7-8 — every agent action posts a short note to a shared,
// chronological case file, in that agent's voice. The numeric matchScore
// on Job is never rewritten by this system — it stays the deterministic
// ground truth; these entries narrate and reason about it, they don't
// replace it. When two agents can't reconcile, the exchange escalates:
// needsYourCall is set, and the user's resolution is recorded rather than
// either agent unilaterally winning.
export type AgentName = "Sage" | "Scout" | "Compass" | "Quill" | "Ledger" | "Lens"

export type CaseFileEntry = {
  id: string
  ownerId: string
  agent: AgentName
  message: string
  createdAt: string
  jobId?: string
  applicationId?: string
  // Groups entries belonging to one exchange when they aren't naturally
  // tied together by jobId (e.g. Lens/Ledger's channel/source digest,
  // which isn't about any single Job) — set to the same value across every
  // entry in that exchange. jobId already does this job for Compass/Scout;
  // threadId exists for the exchanges that have no natural Job to key on.
  threadId?: string
  needsYourCall?: boolean
  resolvedAt?: string
  resolution?: string
}

// Quill's staged output for one Application (spec §7, §16) — "assembles a
// tailored resume (selecting/reordering bullets, projects, and skills)
// and cover letter per Job... stages everything; never touches submit."
// experience/skills/projects here are always resolved server-side against
// the user's real Resume data before being saved — the LLM selects and
// orders by reference, it never regenerates this content, so nothing
// here can be a fabricated bullet or skill. Only summary and coverLetter
// are genuinely generated text.
export type TailoredMaterials = {
  id: string
  ownerId: string
  applicationId: string
  jobId: string
  summary: string
  experience: { company: string; title: string; bullets: string[] }[]
  skills: string[]
  projects: { name: string; description: string; link?: string }[]
  coverLetter: string
  // Figures in the generated summary/cover letter that appear nowhere in
  // the resume, profile, or posting — Quill's free text can't be verified
  // structurally, so this flags the one class that can be checked.
  warnings?: string[]
  generatedAt: string
  // Spec §2: "tweak one sentence in a cover letter that didn't quite
  // sound like you" — kept separate from the generated version so a
  // later regeneration doesn't silently clobber a manual edit.
  editedCoverLetter?: string
}

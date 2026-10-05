import type { Application, ApplicationStatus, ApplicationWithJob, Channel, Job, JobSource } from "@/lib/types"

// Spec §9/§14/§15: response/interview/offer rates, sliced by channel and
// source. The status pipeline is ordered (Found → Reviewed → Applied →
// Response → Interview → Offer / Rejected / Withdrawn), so "responded"
// means the status has moved past Applied into Response/Interview/Offer
// specifically — Rejected/Withdrawn are excluded from "responded" since
// in practice a rejection often lands without the user ever logging an
// explicit Response step first, and this keeps the metric honest about
// what it's actually counting rather than assuming every rejection was
// preceded by contact.
const APPLIED_OR_LATER: ApplicationStatus[] = [
  "Applied",
  "Response",
  "Interview",
  "Offer",
  "Rejected",
  "Withdrawn",
]
const RESPONDED: ApplicationStatus[] = ["Response", "Interview", "Offer"]
const REACHED_INTERVIEW: ApplicationStatus[] = ["Interview", "Offer"]

export type RateStats = {
  appliedCount: number
  responseRate: number
  interviewRate: number
  offerRate: number
}

function computeRates(apps: { status: ApplicationStatus }[]): RateStats {
  const applied = apps.filter((a) => APPLIED_OR_LATER.includes(a.status))
  const appliedCount = applied.length
  if (appliedCount === 0) {
    return { appliedCount: 0, responseRate: 0, interviewRate: 0, offerRate: 0 }
  }
  const responded = applied.filter((a) => RESPONDED.includes(a.status)).length
  const interviewed = applied.filter((a) => REACHED_INTERVIEW.includes(a.status)).length
  const offers = applied.filter((a) => a.status === "Offer").length
  return {
    appliedCount,
    responseRate: Math.round((responded / appliedCount) * 100),
    interviewRate: Math.round((interviewed / appliedCount) * 100),
    offerRate: Math.round((offers / appliedCount) * 100),
  }
}

export function computeOverallStats(applications: ApplicationWithJob[]) {
  return {
    totalApplications: applications.length,
    ...computeRates(applications),
  }
}

export type RateGroup = { key: string; label: string } & RateStats

const CHANNEL_LABELS: Record<Channel, string> = {
  cold: "Cold",
  referral: "Referral",
  "recruiter outreach": "Recruiter outreach",
}

export function computeRatesByChannel(applications: ApplicationWithJob[]): RateGroup[] {
  return groupAndRate(applications, (a) => a.channel ?? "unspecified", (key) =>
    key === "unspecified" ? "No channel set" : CHANNEL_LABELS[key as Channel],
  )
}

export const SOURCE_LABELS: Record<JobSource, string> = {
  adzuna: "Adzuna",
  arbeitnow: "Arbeitnow",
  remoteok: "RemoteOK",
  weworkremotely: "We Work Remotely",
  usajobs: "USAJobs",
  themuse: "The Muse",
  jobicy: "Jobicy",
  manual: "Manually added",
}

export function computeRatesBySource(applications: ApplicationWithJob[]): RateGroup[] {
  return groupAndRate(
    applications,
    (a) => a.job?.source ?? "unknown",
    (key) => (key === "unknown" ? "Unknown source" : SOURCE_LABELS[key as JobSource]),
  )
}

function groupAndRate(
  applications: ApplicationWithJob[],
  keyOf: (a: ApplicationWithJob) => string,
  labelOf: (key: string) => string,
): RateGroup[] {
  const groups = new Map<string, ApplicationWithJob[]>()
  for (const app of applications) {
    const key = keyOf(app)
    const list = groups.get(key) ?? []
    list.push(app)
    groups.set(key, list)
  }

  const rows: RateGroup[] = []
  for (const [key, apps] of groups) {
    const rates = computeRates(apps)
    if (rates.appliedCount === 0) continue
    rows.push({ key, label: labelOf(key), ...rates })
  }
  return rows.sort((a, b) => b.responseRate - a.responseRate)
}

// Source quality at the DISCOVERY stage, not the application stage — of
// everything a source has ever turned up, what fraction got pursued vs.
// dismissed, so a consistently-ignored source can be turned off (fewer
// postings to wade through, fewer LLM calls on junk). This is a different
// question from computeRatesBySource above (which only looks at postings
// that became Applications and asks how they performed afterward) — a
// source can have a great response rate on the few jobs pursued from it
// while still being mostly noise overall.
export type SourceFunnelGroup = {
  key: string
  label: string
  discovered: number
  pursued: number
  dismissed: number
  pending: number
  // Of DECIDED postings only (pursued + dismissed) — a source that was
  // just pulled and still has everything sitting pending shouldn't look
  // like a 0% pursue rate, it just hasn't been judged yet.
  pursueRate: number
}

export function computePursueRatesBySource(jobs: Job[], applications: Application[]): SourceFunnelGroup[] {
  const pursuedJobIds = new Set(applications.map((a) => a.jobId))
  const groups = new Map<string, Job[]>()
  for (const job of jobs) {
    const key = job.source ?? "unknown"
    const list = groups.get(key) ?? []
    list.push(job)
    groups.set(key, list)
  }

  const rows: SourceFunnelGroup[] = []
  for (const [key, list] of groups) {
    const pursued = list.filter((j) => pursuedJobIds.has(j.id)).length
    const dismissed = list.filter((j) => j.reviewStatus === "dismissed" && !pursuedJobIds.has(j.id)).length
    const decided = pursued + dismissed
    rows.push({
      key,
      label: key === "unknown" ? "Unknown source" : (SOURCE_LABELS[key as JobSource] ?? key),
      discovered: list.length,
      pursued,
      dismissed,
      pending: list.length - decided,
      pursueRate: decided > 0 ? Math.round((pursued / decided) * 100) : 0,
    })
  }
  return rows.sort((a, b) => b.discovered - a.discovered)
}

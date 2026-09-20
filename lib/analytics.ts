import type { ApplicationStatus, ApplicationWithJob, Channel, JobSource } from "@/lib/types"

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

const SOURCE_LABELS: Record<JobSource, string> = {
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

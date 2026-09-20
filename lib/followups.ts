import type { Application, ApplicationStatus } from "@/lib/types"

// Spec Section 10: surface an Application once it's been "Applied" for
// longer than a configurable window (default 10 business days) with no
// Response. followUpDate is a manual override — set it on an application
// (e.g. "recruiter said check back in 3 weeks") and it takes priority
// over the automatic 10-business-day default.
const DEFAULT_FOLLOW_UP_BUSINESS_DAYS = 10

// Statuses where a status change already answers "did they respond" —
// nothing to nag about once the application has moved past Applied.
const NO_FOLLOW_UP_NEEDED: ApplicationStatus[] = [
  "Response",
  "Interview",
  "Offer",
  "Rejected",
  "Withdrawn",
]

// Dates in this app are stored as plain "YYYY-MM-DD" strings with no
// time component. Parsing that with `new Date(str)` reads it as UTC
// midnight, which shifts to the previous *local* day in any timezone
// behind UTC — a real off-by-one bug for exactly the kind of date-only
// comparison this function does. Building the Date from explicit
// year/month/day components keeps everything in local calendar time.
function parseDateOnly(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number)
  return new Date(y, m - 1, d)
}

function startOfToday(): Date {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today
}

function addBusinessDays(start: Date, days: number): Date {
  const result = new Date(start)
  let added = 0
  while (added < days) {
    result.setDate(result.getDate() + 1)
    const dayOfWeek = result.getDay()
    if (dayOfWeek !== 0 && dayOfWeek !== 6) added++
  }
  return result
}

export function isOverdueForFollowUp(
  app: Pick<Application, "status" | "appliedDate" | "followUpDate">,
  today: Date = startOfToday(),
): boolean {
  if (NO_FOLLOW_UP_NEEDED.includes(app.status)) return false

  if (app.followUpDate) {
    return parseDateOnly(app.followUpDate) <= today
  }
  if (app.status === "Applied" && app.appliedDate) {
    const threshold = addBusinessDays(parseDateOnly(app.appliedDate), DEFAULT_FOLLOW_UP_BUSINESS_DAYS)
    return threshold <= today
  }
  return false
}

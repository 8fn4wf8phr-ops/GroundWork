import type { FollowUpDue, UpcomingFollowUp } from "@/lib/email/templates"
import type { Outreach } from "@/lib/types"

// Shared by the daily-reminder cron, the weekly digest, and the Profile
// page's test-send panel — all three need the same "which applications
// have a followUpDate in this window" logic, just with a different
// window. Pure and framework-agnostic so it works identically against the
// client SDK's ApplicationWithJob (browser) and the Admin SDK's joined
// data (cron), which is why it takes plain {followUpDate, status, job}
// shapes rather than importing ApplicationWithJob directly.
type FollowUpSource = { followUpDate?: string; status: string; job?: { title: string; company: string } }

function label(a: FollowUpSource): { title: string; company: string } {
  return { title: a.job?.title ?? "Untitled role", company: a.job?.company ?? "Unknown company" }
}

// today: an ISO "YYYY-MM-DD" string, matching the <input type="date">
// format followUpDate is stored in — plain string equality/comparison is
// correct chronological ordering for that format, no Date parsing needed.
export function dueToday(applications: FollowUpSource[], today: string): FollowUpDue[] {
  return applications.filter((a) => a.followUpDate === today).map((a) => ({ ...label(a), status: a.status }))
}

export function upcomingWithinDays(applications: FollowUpSource[], today: string, days: number): UpcomingFollowUp[] {
  const end = new Date(`${today}T00:00:00Z`)
  end.setUTCDate(end.getUTCDate() + days)
  const endStr = end.toISOString().slice(0, 10)
  return applications
    .filter((a) => a.followUpDate && a.followUpDate >= today && a.followUpDate <= endStr)
    .map((a) => ({ ...label(a), followUpDate: a.followUpDate! }))
    .sort((a, b) => a.followUpDate.localeCompare(b.followUpDate))
}

// Outreach's own shape doesn't nest a `job` the way Applications do (it's
// "company" and "contactName" directly), so these are separate small
// functions rather than forcing Outreach through the shape above — same
// date-window logic, applied to what Herald/Ledger actually track. This is
// the "reuse the existing follow-up-date + email-reminder system" the
// Herald spec asked for: Outreach items land in the same two emails
// Applications already use, not a third notification type.
function outreachLabel(o: Outreach): { title: string; company: string } {
  return { title: `Follow up with ${o.contactName}`, company: o.company }
}

export function dueTodayOutreach(outreach: Outreach[], today: string): FollowUpDue[] {
  return outreach.filter((o) => o.followUpDate === today).map((o) => ({ ...outreachLabel(o), status: o.status }))
}

export function upcomingOutreach(outreach: Outreach[], today: string, days: number): UpcomingFollowUp[] {
  const end = new Date(`${today}T00:00:00Z`)
  end.setUTCDate(end.getUTCDate() + days)
  const endStr = end.toISOString().slice(0, 10)
  return outreach
    .filter((o) => o.followUpDate && o.followUpDate >= today && o.followUpDate <= endStr)
    .map((o) => ({ ...outreachLabel(o), followUpDate: o.followUpDate! }))
    .sort((a, b) => a.followUpDate.localeCompare(b.followUpDate))
}

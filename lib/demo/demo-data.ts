// Static sample data for the public, no-login demo (/demo). Deliberately
// NOT wired to Firestore or Anthropic — a visitor shouldn't need an
// account, and this shouldn't spend real API budget. Picked to show off
// the parts of Groundwork that are hardest to convey in a screenshot
// alone: the scoring rubric's seniority penalty and clearance flag
// (JOURNEY.md §28), a real agent disagreement that escalates to the user
// (spec §8's "Needs your call"), and the pursue-rate-by-source funnel
// (also §28).

export type DemoJob = {
  id: string
  title: string
  company: string
  location: string
  remote: boolean
  matchScore: number
  matchReasons: string[]
  postingUrl?: string
}

export const DEMO_REVIEW_QUEUE: DemoJob[] = [
  {
    id: "d1",
    title: "Frontend Engineer",
    company: "Northwind Labs",
    location: "Remote",
    remote: true,
    matchScore: 92,
    matchReasons: [
      'Title overlaps with target role "Frontend Engineer"',
      "Remote — matches your target locations",
      '3 of your resume skills show up in the posting: React, TypeScript, GraphQL',
    ],
  },
  {
    id: "d2",
    title: "Senior Frontend Engineer",
    company: "Argon Health",
    location: "Remote",
    remote: true,
    matchScore: 22,
    matchReasons: [
      'Title overlaps with target role "Frontend Engineer"',
      "Remote — matches your target locations",
      'Senior-level title ("Senior") doesn\'t match your target seniority — scored down',
    ],
  },
  {
    id: "d3",
    title: "Full-Stack Developer",
    company: "Bluepeak Systems",
    location: "Remote — US only",
    remote: true,
    matchScore: 68,
    matchReasons: [
      'Title overlaps with target role "Frontend Engineer"',
      "2 of your resume skills show up in the posting: TypeScript, Node.js",
      'Possible red flag: mentions a security clearance requirement',
    ],
  },
  {
    id: "d4",
    title: "Product Engineer",
    company: "Fairweather",
    location: "Remote",
    remote: true,
    matchScore: 55,
    matchReasons: ["Remote — matches your target locations", '1 of your resume skills show up in the posting: React'],
  },
]

export type DemoColumn = "Found" | "Applied" | "Interview" | "Offer" | "Rejected"

export type DemoApplication = {
  id: string
  title: string
  company: string
  status: DemoColumn
  channel?: "Cold" | "Referral" | "Recruiter"
  highlight?: boolean
}

export const DEMO_APPLICATIONS: DemoApplication[] = [
  { id: "a1", title: "Frontend Engineer", company: "Northwind Labs", status: "Found", channel: "Cold" },
  { id: "a2", title: "Platform Engineer", company: "Meridian", status: "Applied", channel: "Referral" },
  { id: "a3", title: "Software Engineer II", company: "Caldera", status: "Applied", channel: "Cold" },
  { id: "a4", title: "Senior Product Engineer", company: "Ridgeline", status: "Interview", channel: "Recruiter", highlight: true },
  { id: "a5", title: "Frontend Engineer", company: "Juniper Co", status: "Offer", channel: "Referral", highlight: true },
  { id: "a6", title: "Full-Stack Engineer", company: "Dustbowl Analytics", status: "Rejected", channel: "Cold" },
]

export type DemoCaseFileEntry = {
  id: string
  agent: "Compass" | "Scout" | "Ledger" | "Lens" | "Sage"
  message: string
  needsYourCall?: boolean
}

export const DEMO_CASE_FILE: DemoCaseFileEntry[] = [
  {
    id: "c1",
    agent: "Compass",
    message:
      "Frontend Engineer at Northwind Labs is a strong one — 92% — the title, location, and three of your resume skills all line up cleanly.",
  },
  {
    id: "c2",
    agent: "Scout",
    message:
      "Worth a second look before you pursue it: this is the third \"Full-Stack Developer\" posting from a company repeating the same listing across boards in two weeks. Could be a real pipeline, could be a req that keeps falling through.",
  },
  {
    id: "c3",
    agent: "Compass",
    message:
      "Fair, but the posting itself reads specific — named team, named tech stack, not boilerplate. I'd still flag it, not hold it back.",
    needsYourCall: true,
  },
  {
    id: "c4",
    agent: "Ledger",
    message: "Logged: Senior Product Engineer at Ridgeline moved from Applied to Interview.",
  },
  {
    id: "c5",
    agent: "Lens",
    message:
      "Referral applications are responding at 3x the rate of cold ones this month (2 of 2 vs. 1 of 6) — small sample, but worth noticing.",
  },
]

export type DemoRateGroup = { label: string; appliedCount: number; responseRate: number; interviewRate: number; offerRate: number }

export const DEMO_OVERALL = { totalApplications: 6, responseRate: 50, interviewRate: 33, offerRate: 17 }

export const DEMO_BY_CHANNEL: DemoRateGroup[] = [
  { label: "Referral", appliedCount: 2, responseRate: 100, interviewRate: 50, offerRate: 50 },
  { label: "Cold", appliedCount: 3, responseRate: 33, interviewRate: 0, offerRate: 0 },
  { label: "Recruiter outreach", appliedCount: 1, responseRate: 100, interviewRate: 100, offerRate: 0 },
]

export type DemoSourceFunnel = {
  label: string
  discovered: number
  pursued: number
  dismissed: number
  pending: number
  pursueRate: number
}

export const DEMO_PURSUE_RATES: DemoSourceFunnel[] = [
  { label: "Arbeitnow", discovered: 340, pursued: 4, dismissed: 298, pending: 38, pursueRate: 1 },
  { label: "The Muse", discovered: 85, pursued: 3, dismissed: 61, pending: 21, pursueRate: 5 },
  { label: "RemoteOK", discovered: 210, pursued: 1, dismissed: 204, pending: 5, pursueRate: 0 },
  { label: "Adzuna", discovered: 52, pursued: 2, dismissed: 40, pending: 10, pursueRate: 5 },
]

import type { NotablePattern } from "@/lib/agents/pattern-signals"

// Pure email-content builders — no Firestore, no network, no framework
// imports — so they can be called identically from an interactive route
// (client-supplied, Zod-validated data), the Admin-SDK cron, and the
// manual test-send route, and tested directly with plain objects. Plain
// text on purpose (Requirements: "keep email copy plain... not generic
// marketing copy") — every one of these reads like a note in the case
// file, not a newsletter.

export type Email = { subject: string; text: string }

// --- Follow-up reminder (daily cron) ---------------------------------

export type FollowUpDue = { title: string; company: string; status: string }

export function buildFollowUpReminderEmail(applications: FollowUpDue[]): Email | null {
  if (applications.length === 0) return null
  const lines = applications.map((a) => `- ${a.title} at ${a.company} (currently: ${a.status})`)
  return {
    subject: `${applications.length} follow-up${applications.length === 1 ? "" : "s"} due today`,
    text: [
      `Due today:`,
      ``,
      ...lines,
      ``,
      `That's everything on today's list. Nothing here gets sent for you — this is just the reminder.`,
    ].join("\n"),
  }
}

// --- New match notification (after a discovery pull) -----------------

export type NewMatch = {
  title: string
  company: string
  location: string
  matchScore: number
  matchReasons: string[]
  postingUrl?: string
}

const NEW_MATCH_THRESHOLD = 70

export function buildNewMatchEmail(jobs: NewMatch[]): Email | null {
  const strong = jobs.filter((j) => j.matchScore > NEW_MATCH_THRESHOLD).sort((a, b) => b.matchScore - a.matchScore)
  if (strong.length === 0) return null

  const blocks = strong.map((j) => {
    const reasons = j.matchReasons.length > 0 ? j.matchReasons.join("; ") : "no specific reasons recorded"
    const link = j.postingUrl ? `\n  ${j.postingUrl}` : ""
    return `- ${j.title} at ${j.company} (${j.location}) — ${j.matchScore}/100\n  ${reasons}${link}`
  })

  return {
    subject: `${strong.length} new match${strong.length === 1 ? "" : "es"} scoring above ${NEW_MATCH_THRESHOLD}`,
    text: [`New postings that scored above ${NEW_MATCH_THRESHOLD}/100:`, ``, ...blocks].join("\n"),
  }
}

// --- Weekly digest (weekly cron) --------------------------------------

export type StatusCount = { status: string; count: number }
export type RateSummary = { totalApplications: number; responseRate: number; interviewRate: number; offerRate: number }
export type UpcomingFollowUp = { title: string; company: string; followUpDate: string }

export function buildWeeklyDigestEmail(input: {
  statusCounts: StatusCount[]
  overall: RateSummary
  upcomingFollowUps: UpcomingFollowUp[]
  pattern: NotablePattern | null
}): Email {
  const statusLines =
    input.statusCounts.length > 0
      ? input.statusCounts.map((s) => `- ${s.status}: ${s.count}`)
      : ["- nothing tracked yet"]

  const followUpLines =
    input.upcomingFollowUps.length > 0
      ? input.upcomingFollowUps.map((f) => `- ${f.followUpDate}: ${f.title} at ${f.company}`)
      : ["- none scheduled"]

  const patternLine = input.pattern
    ? `Lens: ${input.pattern.leaderLabel} is responding at ${input.pattern.leaderRate}% vs. ${input.pattern.laggardLabel} at ${input.pattern.laggardRate}%` +
      (input.pattern.lowConfidence
        ? ` — though that's on ${Math.min(input.pattern.leaderSampleSize, input.pattern.laggardSampleSize)} applications, not enough to trust yet.`
        : ".")
    : "Lens: nothing stands out enough yet to flag."

  return {
    subject: `Weekly digest — ${input.overall.totalApplications} applications tracked`,
    text: [
      `By status:`,
      ...statusLines,
      ``,
      `Response rate: ${input.overall.responseRate}% · Interview rate: ${input.overall.interviewRate}% · Offer rate: ${input.overall.offerRate}%`,
      `(${input.overall.totalApplications} applications total)`,
      ``,
      `Upcoming follow-ups:`,
      ...followUpLines,
      ``,
      patternLine,
    ].join("\n"),
  }
}

// --- Tailored materials confirmation (after Quill generates) ---------

export type TailoredMaterialsCopy = {
  summary: string
  skills: string[]
  experience: { company: string; title: string; bullets: string[] }[]
  projects: { name: string; description: string; link?: string }[]
  coverLetter: string
}

export function buildTailoredMaterialsEmail(job: { title: string; company: string }, materials: TailoredMaterialsCopy): Email {
  const experienceBlock = materials.experience
    .map((e) => `${e.company} — ${e.title}\n` + e.bullets.map((b) => `  - ${b}`).join("\n"))
    .join("\n\n")
  const projectsBlock = materials.projects
    .map((p) => `- ${p.name}: ${p.description}${p.link ? ` (${p.link})` : ""}`)
    .join("\n")

  return {
    subject: `Tailored materials ready — ${job.title} at ${job.company}`,
    text: [
      `Quill generated new tailored materials for ${job.title} at ${job.company}. A copy, for your records:`,
      ``,
      `SUMMARY`,
      materials.summary,
      ``,
      `SKILLS`,
      materials.skills.join(", ") || "(none selected)",
      ``,
      `EXPERIENCE`,
      experienceBlock || "(none selected)",
      ``,
      `PROJECTS`,
      projectsBlock || "(none selected)",
      ``,
      `COVER LETTER`,
      materials.coverLetter,
      ``,
      `This is exactly what's staged in the app — nothing here has been submitted anywhere.`,
    ].join("\n"),
  }
}

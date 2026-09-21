import type Anthropic from "@anthropic-ai/sdk"
import { z } from "zod"
import { agentRoute, narrate, parseStructured } from "@/lib/server/agent-route"

// Server-side only — ANTHROPIC_API_KEY is a real secret tied to billing,
// same reasoning as the Adzuna key (see app/api/discovery/adzuna/route.ts).
// Auth, size limits and error handling live in lib/server/agent-route.ts.

// Mirrors MAX_JOBS_TO_REVIEW on the client (lib/agents/review-jobs.ts) —
// enforced here too, since a client-side cap doesn't bind a direct caller.
const MAX_JOBS_PER_REQUEST = 3

const CompassResponseSchema = z.object({
  message: z.string(),
  // true = Compass disagrees with Scout's concern and holds its position
  // — spec §8: "when two agents can't reconcile," that's what escalates
  // to the user, not either agent unilaterally winning.
  standsFirm: z.boolean(),
})

const COMPASS_SYSTEM = `You are Compass, the matching agent for Groundwork, a personal job-search assistant. Your personality: analytical, direct, allergic to sugarcoating but never unkind about it. You always show your work.

You will be given a computed match score and the specific reasons behind it. Write ONE short, natural sentence — like a real note in a shared case file a teammate would read, not a report — in your own voice. Never state a different numeric score than the one you're given, and never invent facts you weren't given.`

const SCOUT_SYSTEM = `You are Scout, the discovery agent for Groundwork, a personal job-search assistant. Your personality: restless, a little scrappy, genuinely likes the hunt. You report back plainly, including when something's off.

You will be given one specific, verified concern about a posting. Write ONE short, natural sentence flagging it — like a real note in a shared case file — in your own voice. Only reference the fact you were given; never invent additional concerns.`

const short = z.string().max(300)
const RequestSchema = z.object({
  jobs: z
    .array(
      z.object({
        jobId: z.string().max(128),
        title: short,
        company: short,
        location: short,
        matchScore: z.number().min(0).max(100),
        matchReasons: z.array(short).max(20),
        concernSignal: z.string().max(500).nullable(),
      }),
    )
    .max(MAX_JOBS_PER_REQUEST),
  profile: z.object({ targetRoles: z.array(z.string().max(200)).max(20) }),
})
type JobInput = z.infer<typeof RequestSchema>["jobs"][number]
type ProfileInput = z.infer<typeof RequestSchema>["profile"]

type CaseFileEntryDraft = {
  agent: "Compass" | "Scout"
  message: string
  jobId: string
  needsYourCall?: boolean
}

function compassPrompt(job: JobInput, profile: ProfileInput): string {
  return [
    `A posting was just scored against the user's profile.`,
    `Title: "${job.title}" at ${job.company} (${job.location}).`,
    `Computed match score: ${job.matchScore}/100.`,
    `Scoring reasons: ${job.matchReasons.length > 0 ? job.matchReasons.join("; ") : "none — low overlap with the profile"}.`,
    `User's target roles: ${profile.targetRoles.length > 0 ? profile.targetRoles.join(", ") : "none set yet"}.`,
    `Write your case-file note about this match.`,
  ].join("\n")
}

function scoutPrompt(job: JobInput): string {
  return [
    `You noticed something about this posting: "${job.title}" at ${job.company}.`,
    `Verified fact: ${job.concernSignal}`,
    `Compass scored it ${job.matchScore}/100 without weighing this. Write a short note flagging it.`,
  ].join("\n")
}

function compassResponsePrompt(job: JobInput, compassMessage: string, scoutMessage: string): string {
  return [
    `You (Compass) previously wrote: "${compassMessage}" — about "${job.title}" at ${job.company}, scored ${job.matchScore}/100.`,
    `Scout just pushed back: "${scoutMessage}"`,
    `Decide: does this genuinely change your assessment, or do you stand by your original read?`,
    `Respond in character. Set standsFirm to true only if you disagree with Scout's concern and are holding your position — that signals this should go to the user to decide. Set it to false if you're revising or conceding the point.`,
  ].join("\n")
}

async function reviewOneJob(
  client: Anthropic,
  job: JobInput,
  profile: ProfileInput,
): Promise<CaseFileEntryDraft[]> {
  const compassMessage =
    (await narrate(client, { system: COMPASS_SYSTEM, prompt: compassPrompt(job, profile), maxTokens: 300 })) ??
    `Scored this one ${job.matchScore}/100.`

  const entries: CaseFileEntryDraft[] = [{ agent: "Compass", message: compassMessage, jobId: job.jobId }]

  if (job.concernSignal) {
    const scoutMessage =
      (await narrate(client, { system: SCOUT_SYSTEM, prompt: scoutPrompt(job), maxTokens: 300 })) ??
      job.concernSignal
    entries.push({ agent: "Scout", message: scoutMessage, jobId: job.jobId })

    const compassResponse = await parseStructured(client, {
      system: COMPASS_SYSTEM,
      prompt: compassResponsePrompt(job, compassMessage, scoutMessage),
      maxTokens: 300,
      schema: CompassResponseSchema,
    })
    const standsFirm = compassResponse?.standsFirm ?? true
    const responseMessage = compassResponse?.message ?? "Standing by my original read on this one."
    entries.push({ agent: "Compass", message: responseMessage, jobId: job.jobId, needsYourCall: standsFirm })
  }

  return entries
}

export const POST = agentRoute({ name: "Agent review", schema: RequestSchema }, async ({ client, body }) => {
  // allSettled, not all: each job's exchange is independent, so one job
  // hitting a rate limit or a parse failure must not throw away the
  // exchanges the other jobs already completed (and were paid for).
  const settled = await Promise.allSettled(body.jobs.map((job) => reviewOneJob(client, job, body.profile)))

  const entries = settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []))
  const failures = settled.filter((r): r is PromiseRejectedResult => r.status === "rejected")
  for (const failure of failures) console.error("[agents] Agent review: one job failed:", failure.reason)

  // Only a total failure is an error; a partial result is still useful.
  if (failures.length > 0 && entries.length === 0) throw failures[0].reason
  return { entries }
})

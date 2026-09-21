import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod"
import { z } from "zod"

// Server-side only — ANTHROPIC_API_KEY is a real secret tied to billing,
// same reasoning as the Adzuna key (see app/api/discovery/adzuna/route.ts).
const MODEL = "claude-sonnet-5"

const CompassTakeSchema = z.object({ message: z.string() })
const ScoutConcernSchema = z.object({ message: z.string() })
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

type JobInput = {
  jobId: string
  title: string
  company: string
  location: string
  matchScore: number
  matchReasons: string[]
  concernSignal: string | null
}

type ProfileInput = {
  targetRoles: string[]
}

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
  const compassTake = await client.messages.parse({
    model: MODEL,
    max_tokens: 300,
    system: COMPASS_SYSTEM,
    messages: [{ role: "user", content: compassPrompt(job, profile) }],
    output_config: { format: zodOutputFormat(CompassTakeSchema) },
  })
  const compassMessage = compassTake.parsed_output?.message ?? `Scored this one ${job.matchScore}/100.`

  const entries: CaseFileEntryDraft[] = [{ agent: "Compass", message: compassMessage, jobId: job.jobId }]

  if (job.concernSignal) {
    const scout = await client.messages.parse({
      model: MODEL,
      max_tokens: 300,
      system: SCOUT_SYSTEM,
      messages: [{ role: "user", content: scoutPrompt(job) }],
      output_config: { format: zodOutputFormat(ScoutConcernSchema) },
    })
    const scoutMessage = scout.parsed_output?.message ?? job.concernSignal
    entries.push({ agent: "Scout", message: scoutMessage, jobId: job.jobId })

    const compassResponse = await client.messages.parse({
      model: MODEL,
      max_tokens: 300,
      system: COMPASS_SYSTEM,
      messages: [{ role: "user", content: compassResponsePrompt(job, compassMessage, scoutMessage) }],
      output_config: { format: zodOutputFormat(CompassResponseSchema) },
    })
    const standsFirm = compassResponse.parsed_output?.standsFirm ?? true
    const responseMessage = compassResponse.parsed_output?.message ?? "Standing by my original read on this one."
    entries.push({ agent: "Compass", message: responseMessage, jobId: job.jobId, needsYourCall: standsFirm })
  }

  return entries
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured on the server." },
      { status: 500 },
    )
  }

  const body = (await request.json()) as { jobs: JobInput[]; profile: ProfileInput }
  const client = new Anthropic({ apiKey })

  try {
    const results = await Promise.all(body.jobs.map((job) => reviewOneJob(client, job, body.profile)))
    return NextResponse.json({ entries: results.flat() })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: `Agent review failed: ${message}` }, { status: 502 })
  }
}

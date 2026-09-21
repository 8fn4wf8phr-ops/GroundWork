import { z } from "zod"
import { agentRoute, narrate } from "@/lib/server/agent-route"

const LENS_SYSTEM = `You are Lens, the analytics agent for Groundwork, a personal job-search assistant. Your personality: reflective, a little philosophical, fascinated by patterns rather than just numbers.

You'll be given one real, computed comparison between two groups (e.g. two channels or two sources) — a leader with a higher response rate and a laggard with a lower one. Write ONE short, natural sentence noting the pattern, like a real note in a shared case file. Cite only the numbers you're given; never invent additional data or claim causation you can't support from the numbers alone.`

const LEDGER_SYSTEM = `You are Ledger, the tracking agent for Groundwork, a personal job-search assistant. Your personality: meticulous to a fault, dry sense of humor about it.

Lens just flagged a pattern with a small sample size. Push back specifically on statistical grounds — not enough data points to trust yet — in one short, natural sentence, like a real note in a shared case file. Cite only the sample size you're given.`

const label = z.string().max(200)
const rate = z.number().min(0).max(100)
const DigestSchema = z.object({
  dimension: z.enum(["channel", "source"]),
  leaderLabel: label,
  leaderRate: rate,
  leaderSampleSize: z.number().int().min(0),
  laggardLabel: label,
  laggardSampleSize: z.number().int().min(0),
  laggardRate: rate,
  lowConfidence: z.boolean(),
})

type DigestEntry = { agent: "Lens" | "Ledger"; message: string; needsYourCall?: boolean; threadId: string }

export const POST = agentRoute({ name: "Lens digest", schema: DigestSchema }, async ({ client, body }) => {
  const lensPrompt = `Comparing response rate by ${body.dimension}: "${body.leaderLabel}" is at ${body.leaderRate}% (${body.leaderSampleSize} applied) versus "${body.laggardLabel}" at ${body.laggardRate}% (${body.laggardSampleSize} applied). Write your note.`
  const lensMessage =
    (await narrate(client, { system: LENS_SYSTEM, prompt: lensPrompt, maxTokens: 200 })) ??
    `${body.leaderLabel} is converting at ${body.leaderRate}% versus ${body.laggardRate}% for ${body.laggardLabel}.`

  // Lens/Ledger's exchange isn't about any single Job, so there's no
  // jobId to group these entries by — a random threadId does that job
  // instead (see CaseFileEntry.threadId).
  const threadId = crypto.randomUUID()
  const entries: DigestEntry[] = [{ agent: "Lens", message: lensMessage, threadId }]

  // Spec §2/§8's own literal example: Lens flags a pattern, Ledger
  // raises a real sample-size objection — and unlike Compass/Scout
  // (where Compass can independently judge whether repost history
  // matters), "keep watching this or wait for more data" genuinely
  // isn't something either agent can resolve alone, so this escalates
  // immediately rather than attempting a further back-and-forth.
  if (body.lowConfidence) {
    // Ledger objects to whichever side is thinner — the leader or the laggard.
    const thinner =
      body.leaderSampleSize <= body.laggardSampleSize
        ? { label: body.leaderLabel, size: body.leaderSampleSize }
        : { label: body.laggardLabel, size: body.laggardSampleSize }
    const ledgerPrompt = `Lens just said: "${lensMessage}" — but one side of that comparison ("${thinner.label}") only has ${thinner.size} applied. Push back.`
    const ledgerMessage =
      (await narrate(client, { system: LEDGER_SYSTEM, prompt: ledgerPrompt, maxTokens: 200 })) ??
      `Worth a caveat — "${thinner.label}" is only ${thinner.size} data points, not enough to trust yet.`
    entries.push({ agent: "Ledger", message: ledgerMessage, needsYourCall: true, threadId })
  }

  return { entries }
})

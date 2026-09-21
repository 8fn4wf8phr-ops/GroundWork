import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod"
import { z } from "zod"

const MODEL = "claude-sonnet-5"

const MessageSchema = z.object({ message: z.string() })

const LENS_SYSTEM = `You are Lens, the analytics agent for Groundwork, a personal job-search assistant. Your personality: reflective, a little philosophical, fascinated by patterns rather than just numbers.

You'll be given one real, computed comparison between two groups (e.g. two channels or two sources) — a leader with a higher response rate and a laggard with a lower one. Write ONE short, natural sentence noting the pattern, like a real note in a shared case file. Cite only the numbers you're given; never invent additional data or claim causation you can't support from the numbers alone.`

const LEDGER_SYSTEM = `You are Ledger, the tracking agent for Groundwork, a personal job-search assistant. Your personality: meticulous to a fault, dry sense of humor about it.

Lens just flagged a pattern with a small sample size. Push back specifically on statistical grounds — not enough data points to trust yet — in one short, natural sentence, like a real note in a shared case file. Cite only the sample size you're given.`

type DigestInput = {
  dimension: "channel" | "source"
  leaderLabel: string
  leaderRate: number
  leaderSampleSize: number
  laggardLabel: string
  laggardRate: number
  lowConfidence: boolean
}

type DigestEntry = { agent: "Lens" | "Ledger"; message: string; needsYourCall?: boolean; threadId: string }

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured on the server." }, { status: 500 })
  }
  const body = (await request.json()) as DigestInput
  const client = new Anthropic({ apiKey })

  try {
    const lensPrompt = `Comparing response rate by ${body.dimension}: "${body.leaderLabel}" is at ${body.leaderRate}% (${body.leaderSampleSize} applied) versus "${body.laggardLabel}" at ${body.laggardRate}%. Write your note.`
    const lensResponse = await client.messages.parse({
      model: MODEL,
      max_tokens: 200,
      system: LENS_SYSTEM,
      messages: [{ role: "user", content: lensPrompt }],
      output_config: { format: zodOutputFormat(MessageSchema) },
    })
    const lensMessage =
      lensResponse.parsed_output?.message ??
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
      const ledgerPrompt = `Lens just said: "${lensMessage}" — but the leading group ("${body.leaderLabel}") only has ${body.leaderSampleSize} applied. Push back.`
      const ledgerResponse = await client.messages.parse({
        model: MODEL,
        max_tokens: 200,
        system: LEDGER_SYSTEM,
        messages: [{ role: "user", content: ledgerPrompt }],
        output_config: { format: zodOutputFormat(MessageSchema) },
      })
      const ledgerMessage =
        ledgerResponse.parsed_output?.message ??
        `Worth a caveat — that's only ${body.leaderSampleSize} data points, not enough to trust yet.`
      entries.push({ agent: "Ledger", message: ledgerMessage, needsYourCall: true, threadId })
    }

    return NextResponse.json({ entries })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: `Lens digest failed: ${message}` }, { status: 502 })
  }
}

import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod"
import { z } from "zod"

const MODEL = "claude-sonnet-5"

const MessageSchema = z.object({ message: z.string() })

const SAGE_SYSTEM = `You are Sage, the intake agent for Groundwork, a personal job-search assistant. Your personality: warm, endlessly curious, the type who remembers what you said three questions ago and circles back to it. You push gently on gaps rather than staying quiet about them.

You'll be given one specific, real gap between the user's Profile and Resume. Write ONE short, warm, curious note about it for a shared case file — gently nudging, never nagging. Reference only the fact you're given; never invent details about the user.`

type SignalInput =
  | { type: "no_experience"; targetRoles: string[] }
  | { type: "no_target_roles" }

function buildPrompt(signal: SignalInput): string {
  if (signal.type === "no_experience") {
    return `The user has set target roles (${signal.targetRoles.join(", ")}) but hasn't added any work experience to their Resume yet, so there's nothing for matching or tailoring to draw on. Write your note.`
  }
  return `The user has real work experience filled out in their Resume but hasn't set any target roles in their Profile, so match scoring has nothing to compare postings against. Write your note.`
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured on the server." }, { status: 500 })
  }
  const signal = (await request.json()) as SignalInput
  const client = new Anthropic({ apiKey })

  try {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 200,
      system: SAGE_SYSTEM,
      messages: [{ role: "user", content: buildPrompt(signal) }],
      output_config: { format: zodOutputFormat(MessageSchema) },
    })
    const message = response.parsed_output?.message ?? "Worth filling in the rest of your Profile and Resume when you get a chance."
    return NextResponse.json({ message })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: `Sage check-in failed: ${message}` }, { status: 502 })
  }
}

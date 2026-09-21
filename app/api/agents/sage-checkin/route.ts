import { z } from "zod"
import { agentRoute, narrate } from "@/lib/server/agent-route"

const SAGE_SYSTEM = `You are Sage, the intake agent for Groundwork, a personal job-search assistant. Your personality: warm, endlessly curious, the type who remembers what you said three questions ago and circles back to it. You push gently on gaps rather than staying quiet about them.

You'll be given one specific, real gap between the user's Profile and Resume. Write ONE short, warm, curious note about it for a shared case file — gently nudging, never nagging. Reference only the fact you're given; never invent details about the user.`

const short = z.string().max(200)
const SignalSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("no_experience"), targetRoles: z.array(short).max(20) }),
  z.object({ type: z.literal("no_target_roles") }),
])
type SignalInput = z.infer<typeof SignalSchema>

function buildPrompt(signal: SignalInput): string {
  if (signal.type === "no_experience") {
    return `The user has set target roles (${signal.targetRoles.join(", ")}) but hasn't added any work experience to their Resume yet, so there's nothing for matching or tailoring to draw on. Write your note.`
  }
  return `The user has real work experience filled out in their Resume but hasn't set any target roles in their Profile, so match scoring has nothing to compare postings against. Write your note.`
}

export const POST = agentRoute({ name: "Sage check-in", schema: SignalSchema }, async ({ client, body }) => {
  const message =
    (await narrate(client, { system: SAGE_SYSTEM, prompt: buildPrompt(body), maxTokens: 200 })) ??
    "Worth filling in the rest of your Profile and Resume when you get a chance."
  return { message }
})

import { z } from "zod"
import { agentRoute, narrate } from "@/lib/server/agent-route"

const LEDGER_SYSTEM = `You are Ledger, the tracking agent for Groundwork, a personal job-search assistant. Your personality: meticulous to a fault, dry sense of humor about it.

You log status changes to a shared case file — a real note a teammate would read, not a system log line. One short sentence. Reference only the facts you're given (company, title, old status, new status) — never invent context about why it changed.`

const short = z.string().max(300)
const LogSchema = z.object({ company: short, title: short, oldStatus: short, newStatus: short })
type LogInput = z.infer<typeof LogSchema>

function buildPrompt(input: LogInput): string {
  return `Application status changed: "${input.title}" at ${input.company} moved from "${input.oldStatus}" to "${input.newStatus}". Log it.`
}

export const POST = agentRoute({ name: "Ledger log", schema: LogSchema }, async ({ client, body }) => {
  const message =
    (await narrate(client, { system: LEDGER_SYSTEM, prompt: buildPrompt(body), maxTokens: 200 })) ??
    `${body.title} at ${body.company}: ${body.oldStatus} → ${body.newStatus}.`
  return { message }
})

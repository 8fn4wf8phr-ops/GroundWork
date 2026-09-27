import { z } from "zod"
import { agentRoute } from "@/lib/server/agent-route"
import { summarizeDismissal } from "@/lib/server/dismiss-summary"

const short = z.string().max(300)
const RequestSchema = z.object({
  count: z.number().int().min(1).max(100000),
  threshold: z.number().min(0).max(100),
  sampleTitles: z.array(short).max(10),
  targetRoles: z.array(short).max(20),
})

export const POST = agentRoute({ name: "Dismiss summary", schema: RequestSchema }, async ({ client, body }) => ({
  message: await summarizeDismissal(client, body),
}))

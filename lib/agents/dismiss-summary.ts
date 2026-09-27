import { postAgent } from "@/lib/agents/client"

export async function summarizeDismissal(args: {
  count: number
  threshold: number
  sampleTitles: string[]
  targetRoles: string[]
}): Promise<string> {
  const { message } = await postAgent<{ message: string }>("/api/agents/dismiss-summary", args, "Dismiss summary")
  return message
}

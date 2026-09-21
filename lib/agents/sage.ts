import type { SageSignal } from "@/lib/agents/sage-signals"
import { postAgent } from "@/lib/agents/client"

export async function checkInWithSage(signal: SageSignal): Promise<string> {
  const { message } = await postAgent<{ message: string }>("/api/agents/sage-checkin", signal, "Sage check-in")
  return message
}

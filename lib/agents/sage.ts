import type { SageSignal } from "@/lib/agents/sage-signals"

export async function checkInWithSage(signal: SageSignal): Promise<string> {
  const res = await fetch("/api/agents/sage-checkin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(signal),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Sage check-in returned ${res.status}`)
  }
  const body = await res.json()
  return body.message
}

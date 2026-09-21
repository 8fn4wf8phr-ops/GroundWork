import type { NewCaseFileEntry } from "@/lib/firestore/case-file"
import type { NotablePattern } from "@/lib/agents/pattern-signals"

export async function generateDigest(pattern: NotablePattern): Promise<NewCaseFileEntry[]> {
  const res = await fetch("/api/agents/lens-digest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(pattern),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Lens digest returned ${res.status}`)
  }
  const body = await res.json()
  return body.entries
}

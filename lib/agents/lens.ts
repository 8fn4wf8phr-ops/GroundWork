import type { NewCaseFileEntry } from "@/lib/firestore/case-file"
import type { NotablePattern } from "@/lib/agents/pattern-signals"
import { postAgent } from "@/lib/agents/client"

export async function generateDigest(pattern: NotablePattern): Promise<NewCaseFileEntry[]> {
  const { entries } = await postAgent<{ entries: NewCaseFileEntry[] }>(
    "/api/agents/lens-digest",
    pattern,
    "Lens digest",
  )
  return entries
}

import { postAgent } from "@/lib/agents/client"

export async function logStatusChange(
  company: string,
  title: string,
  oldStatus: string,
  newStatus: string,
): Promise<string> {
  const { message } = await postAgent<{ message: string }>(
    "/api/agents/ledger-log",
    { company, title, oldStatus, newStatus },
    "Ledger log",
  )
  return message
}

export async function logStatusChange(
  company: string,
  title: string,
  oldStatus: string,
  newStatus: string,
): Promise<string> {
  const res = await fetch("/api/agents/ledger-log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ company, title, oldStatus, newStatus }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Ledger log returned ${res.status}`)
  }
  const body = await res.json()
  return body.message
}

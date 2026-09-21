import { authHeader } from "@/lib/auth-header"

// Browser-side call to an /api/agents/* route. The routes spend real
// money on the server's Anthropic key, so each request carries the
// signed-in user's Firebase ID token for the server to verify.
export async function postAgent<T>(path: string, body: unknown, label: string): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}))
    throw new Error(errBody.error ?? `${label} returned ${res.status}`)
  }
  return (await res.json()) as T
}

// The routes reject over-long fields outright (rather than silently
// truncating server-side), so callers holding third-party text — job
// titles, descriptions — trim it to the route's limit first.
export function clip(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) : text
}

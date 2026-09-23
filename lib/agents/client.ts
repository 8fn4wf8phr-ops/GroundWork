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

export { clip } from "@/lib/clip"

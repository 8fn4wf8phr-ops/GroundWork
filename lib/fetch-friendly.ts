// A network-level failure (offline, DNS, CORS, a connection reset mid-
// request) surfaces from fetch() as a bare `TypeError: Failed to fetch` —
// technically accurate, meaningless to a user staring at it in an error
// message. Every caller in this project already handles a clean HTTP
// error response well (reads a real {error} body); what was missing was
// this layer, for the fetch() call failing before any response exists at
// all. Used by lib/agents/client.ts and every lib/discovery/*.ts module.
export async function fetchOrThrow(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  label: string,
): Promise<Response> {
  try {
    return await fetch(input, init)
  } catch {
    throw new Error(`Couldn't reach ${label} — check your connection and try again.`)
  }
}

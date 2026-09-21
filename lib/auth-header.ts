import { auth } from "@/lib/firebase"

// Authorization header carrying the signed-in user's Firebase ID token,
// for calls to our own server routes that spend a paid/quota-limited key
// (the agent routes and the Adzuna proxy). Verified in lib/server/agent-route.ts.
export async function authHeader(): Promise<{ Authorization: string }> {
  const user = auth.currentUser
  if (!user) throw new Error("Sign in required")
  return { Authorization: `Bearer ${await user.getIdToken()}` }
}

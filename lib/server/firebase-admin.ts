import { cert, getApps, initializeApp } from "firebase-admin/app"
import { getFirestore, type Firestore } from "firebase-admin/firestore"

// Firebase Admin SDK for server-only work with no signed-in user (the
// scheduled-discovery cron). Admin access BYPASSES Firestore security
// rules entirely, so the credential is a real secret — FIREBASE_SERVICE_ACCOUNT
// must be a Sensitive env var, never NEXT_PUBLIC_*, and every query made
// with it has to scope by owner explicitly (see lib/server/admin-store.ts).
export class AdminConfigError extends Error {}

type ServiceAccount = { project_id: string; client_email: string; private_key: string }

// Accepts the downloaded key file's JSON as-is, or that JSON base64-encoded
// (handy for env-var UIs that mangle multi-line values).
function parseServiceAccount(raw: string): ServiceAccount {
  const text = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8")
  let parsed: Partial<ServiceAccount>
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new AdminConfigError("FIREBASE_SERVICE_ACCOUNT isn't valid JSON (or base64-encoded JSON).")
  }
  if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
    throw new AdminConfigError("FIREBASE_SERVICE_ACCOUNT is missing project_id, client_email, or private_key.")
  }
  return {
    project_id: parsed.project_id,
    client_email: parsed.client_email,
    // Env vars often carry the key's newlines as a literal backslash-n.
    private_key: parsed.private_key.replace(/\\n/g, "\n"),
  }
}

export function getAdminDb(): Firestore {
  const existing = getApps()[0]
  if (existing) return getFirestore(existing)

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!raw) throw new AdminConfigError("FIREBASE_SERVICE_ACCOUNT is not configured on the server.")
  const account = parseServiceAccount(raw)

  // Refuse a key for a different project than the one the app is built
  // for — the failure mode is quietly writing another project's data.
  const expected = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  if (expected && account.project_id !== expected) {
    throw new AdminConfigError(
      `FIREBASE_SERVICE_ACCOUNT is for project "${account.project_id}", but this app uses "${expected}".`,
    )
  }

  const app = initializeApp({
    credential: cert({
      projectId: account.project_id,
      clientEmail: account.client_email,
      privateKey: account.private_key,
    }),
  })
  const db = getFirestore(app)
  // Optional fields (like Job.remote) are legitimately undefined; the
  // client SDK path strips them via sanitizeForFirestore, and this is the
  // Admin SDK's equivalent. Must be set before the first operation.
  db.settings({ ignoreUndefinedProperties: true })
  return db
}

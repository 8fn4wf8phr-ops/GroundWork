import { createHash, timingSafeEqual } from "node:crypto"

// Shared by every Vercel Cron route (app/api/cron/discover, .../notifications).
// Hashes both sides so the comparison is constant-time and length-safe —
// a plain `===` on the raw header leaks timing information about how much
// of the secret matched.
export function secretMatches(header: string, secret: string): boolean {
  const a = createHash("sha256").update(header).digest()
  const b = createHash("sha256").update(`Bearer ${secret}`).digest()
  return timingSafeEqual(a, b)
}

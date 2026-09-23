// The one place that builds and sends a request to api.adzuna.com. Used by
// the browser-facing proxy route (app/api/discovery/adzuna) and by the
// scheduled-discovery cron, which has no browser to proxy through.
// ADZUNA_APP_KEY is a real secret tied to the account's rate quota — it
// must stay server-side (see the proxy route for the full reasoning).
import type { AdzunaPosting } from "@/lib/discovery/adzuna-map"

export class AdzunaConfigError extends Error {}

export async function callAdzuna(what: string, where: string): Promise<{ results?: AdzunaPosting[] }> {
  const appId = process.env.ADZUNA_APP_ID
  const appKey = process.env.ADZUNA_APP_KEY
  const country = process.env.ADZUNA_COUNTRY || "us"
  if (!appId || !appKey) {
    throw new AdzunaConfigError("Adzuna credentials are not configured (ADZUNA_APP_ID / ADZUNA_APP_KEY).")
  }

  const url = new URL(`https://api.adzuna.com/v1/api/jobs/${country}/search/1`)
  url.searchParams.set("app_id", appId)
  url.searchParams.set("app_key", appKey)
  url.searchParams.set("results_per_page", "50")
  url.searchParams.set("content-type", "application/json")
  if (what) url.searchParams.set("what", what)
  if (where) url.searchParams.set("where", where)

  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`Adzuna API returned ${res.status}`)
  return res.json()
}

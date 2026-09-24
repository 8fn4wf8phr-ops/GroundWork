// We Work Remotely has no JSON API, only RSS feeds per category — and no
// key to protect, but also no CORS header (confirmed live), so a browser
// fetch is blocked the same as USAJobs. This is the one place that fetches
// the feed; the proxy route relays its raw XML, and lib/discovery/wwr-map.ts
// does the parsing.
export async function callWwr(): Promise<string> {
  const res = await fetch("https://weworkremotely.com/categories/remote-programming-jobs.rss")
  if (!res.ok) throw new Error(`We Work Remotely RSS returned ${res.status}`)
  return res.text()
}

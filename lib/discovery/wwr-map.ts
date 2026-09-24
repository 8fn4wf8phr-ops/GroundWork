import type { DiscoveredJob } from "@/lib/discovery/types"
import { stripHtml } from "@/lib/discovery/strip-html"

// Pure RSS parsing/mapping, shared by the browser fetcher (which goes
// through our proxy route — see lib/server/wwr-api.ts for why) and the
// server-side scheduled discovery (which calls the feed directly). Kept
// free of client-only imports, same reasoning as adzuna-map.ts/usajobs-map.ts.
export type WwrSearch = () => Promise<string>

function tag(item: string, name: string): string {
  const match = item.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))
  return match ? match[1].trim() : ""
}

// RSS descriptions here are HTML that's itself been entity-escaped once
// (e.g. "&lt;p&gt;"), confirmed live — decode before stripHtml's own tag
// stripping can see real "<p>" tags, otherwise the escaped markup is left
// behind as visible text.
function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
}

function mapItem(item: string): DiscoveredJob {
  const rawTitle = decodeEntities(tag(item, "title"))
  const separator = rawTitle.indexOf(": ")
  const company = separator === -1 ? "" : rawTitle.slice(0, separator)
  const title = separator === -1 ? rawTitle : rawTitle.slice(separator + 2)
  const guid = tag(item, "guid")

  return {
    title,
    company,
    // Every WWR posting is remote by definition (that's the whole site) —
    // `region` (e.g. "Anywhere in the World", "USA Only") is a scope note,
    // not evidence against remote fit, so it's kept as location text only.
    location: decodeEntities(tag(item, "region")) || "Remote",
    remote: true,
    source: "weworkremotely",
    externalId: guid || tag(item, "link"),
    tags: [decodeEntities(tag(item, "category"))].filter(Boolean),
    postingUrl: tag(item, "link") || guid,
    datePosted: tag(item, "pubDate"),
    description: stripHtml(decodeEntities(tag(item, "description"))),
  }
}

function parseItems(xml: string): string[] {
  return xml.match(/<item>[\s\S]*?<\/item>/g) ?? []
}

// No per-role query support — WWR's RSS feeds are fixed per category, not
// keyword-searchable — so this pulls the whole Programming category (the
// one relevant to this app's software-engineering focus) and leaves
// relevance to the existing scoring algorithm, same tradeoff as Arbeitnow.
export async function fetchWeWorkRemotelyJobs(search: WwrSearch): Promise<DiscoveredJob[]> {
  const xml = await search()
  return parseItems(xml).map(mapItem)
}

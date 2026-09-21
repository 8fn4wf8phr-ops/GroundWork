import type { ProjectEntry } from "@/lib/types"

// Spec §16 — "the site exposes a small public projects.json... the
// tracker's Resume model fetches from that instead of duplicating the
// data, so shipping a new project to the site automatically makes it
// available for tailoring." This is the fetch side; portfolioUrl lives on
// the Resume doc (set once in the Resume view).
type PortfolioProjectJson = {
  name: string
  description: string
  tags?: string[]
  link?: string
  repoLink?: string
}

function stableSourceId(entry: PortfolioProjectJson): string {
  return `portfolio:${entry.link || entry.name}`
}

export async function fetchPortfolioProjects(portfolioUrl: string): Promise<ProjectEntry[]> {
  const base = portfolioUrl.trim().replace(/\/+$/, "")
  const res = await fetch(`${base}/projects.json`)
  if (!res.ok) {
    throw new Error(`Portfolio site returned ${res.status} for projects.json`)
  }
  const body = (await res.json()) as { projects?: PortfolioProjectJson[] } | PortfolioProjectJson[]
  const raw = Array.isArray(body) ? body : (body.projects ?? [])

  return raw
    .filter((p) => p && typeof p.name === "string" && typeof p.description === "string")
    .map((p) => ({
      id: crypto.randomUUID(),
      name: p.name,
      description: p.description,
      skills: Array.isArray(p.tags) ? p.tags : [],
      link: p.link,
      repoLink: p.repoLink,
      sourceId: stableSourceId(p),
    }))
}

// Merges freshly-fetched portfolio projects into the existing bank:
// updates any project previously imported from the same sourceId in
// place (preserving its real `id` so it isn't treated as a new/duplicate
// entry), adds genuinely new ones, and never touches manually-added
// projects (no sourceId) or portfolio projects that disappeared from the
// feed (kept rather than silently deleted, in case the removal was
// unintentional on the site's side).
export function mergePortfolioProjects(existing: ProjectEntry[], fetched: ProjectEntry[]): ProjectEntry[] {
  const existingBySourceId = new Map(existing.filter((p) => p.sourceId).map((p) => [p.sourceId, p]))
  const merged = existing.filter((p) => !p.sourceId || !fetched.some((f) => f.sourceId === p.sourceId))

  for (const project of fetched) {
    const match = existingBySourceId.get(project.sourceId)
    merged.push(match ? { ...project, id: match.id } : project)
  }
  return merged
}

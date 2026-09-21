// Pure post-processing for Quill's output, kept out of the route file so
// it can be tested in isolation (route files can only export handlers).
//
// What this guarantees, precisely:
//  - Experience bullets, skills and projects in the result are *real*:
//    each is looked up by id/index/exact string in the stored Resume, and
//    anything the model referenced that doesn't exist is dropped.
//  - Each one appears at most once, even if the model repeated it.
//
// What it does NOT guarantee: the summary and cover letter are free text
// from the model and can't be verified structurally. findUnsupportedFigures
// catches one checkable class of invention (numbers/percentages/years that
// appear nowhere in the source material), and the caller surfaces those as
// warnings — the rest still relies on the user reading what Quill wrote.

export type ExperienceInput = { id: string; company: string; title: string; bullets: string[] }
export type ProjectInput = { id: string; name: string; description: string; skills: string[]; link?: string }

export type Selection = {
  selectedSkills: string[]
  selectedExperience: { experienceId: string; bulletIndices: number[] }[]
  selectedProjectIds: string[]
}

export type ResolvedSelection = {
  experience: { company: string; title: string; bullets: string[] }[]
  skills: string[]
  projects: { name: string; description: string; link?: string }[]
}

export function resolveSelection(
  selection: Selection,
  resume: { experience: ExperienceInput[]; skills: string[]; projects: ProjectInput[] },
): ResolvedSelection {
  // Merge repeated experienceIds (first-seen order wins) and dedupe their
  // bullet indices, so the same bullet can't be listed twice.
  const indicesByExperience = new Map<string, number[]>()
  for (const sel of selection.selectedExperience) {
    const seen = indicesByExperience.get(sel.experienceId) ?? []
    for (const i of sel.bulletIndices) if (!seen.includes(i)) seen.push(i)
    indicesByExperience.set(sel.experienceId, seen)
  }

  const experienceById = new Map(resume.experience.map((e) => [e.id, e]))
  const experience: ResolvedSelection["experience"] = []
  for (const [experienceId, indices] of indicesByExperience) {
    const entry = experienceById.get(experienceId)
    if (!entry) continue
    const bullets = indices.filter((i) => i >= 0 && i < entry.bullets.length).map((i) => entry.bullets[i])
    if (bullets.length > 0) experience.push({ company: entry.company, title: entry.title, bullets })
  }

  const realSkills = new Set(resume.skills)
  const skills = [...new Set(selection.selectedSkills)].filter((s) => realSkills.has(s))

  const projectsById = new Map(resume.projects.map((p) => [p.id, p]))
  const projects = [...new Set(selection.selectedProjectIds)]
    .map((id) => projectsById.get(id))
    .filter((p): p is ProjectInput => Boolean(p))
    .map((p) => ({ name: p.name, description: p.description, link: p.link }))

  return { experience, skills, projects }
}

// Dollar amounts, percentages, and any number of 2+ digits (years, team
// sizes, "10+ years"). Lone single digits are ignored — "one of two
// reasons" style prose isn't a factual claim worth flagging.
const FIGURE_PATTERN = /[$€£]?\d[\d,]*(?:\.\d+)?%?/g

function extractFigures(text: string): Set<string> {
  const figures = new Set<string>()
  for (const raw of text.match(FIGURE_PATTERN) ?? []) {
    const cleaned = raw.replace(/,/g, "").replace(/\.$/, "")
    const digitsOnly = cleaned.replace(/\D/g, "")
    const isSignificant = /[$€£%]/.test(cleaned) || digitsOnly.length >= 2
    if (isSignificant) figures.add(cleaned)
  }
  return figures
}

const MAX_WARNINGS = 5

export function findUnsupportedFigures(generatedText: string, sourceText: string): string[] {
  const supported = extractFigures(sourceText)
  const warnings: string[] = []
  for (const figure of extractFigures(generatedText)) {
    if (!supported.has(figure)) {
      warnings.push(
        `The generated text mentions "${figure}", which doesn't appear in your resume, profile, or the posting — double-check it before sending.`,
      )
    }
    if (warnings.length >= MAX_WARNINGS) break
  }
  return warnings
}

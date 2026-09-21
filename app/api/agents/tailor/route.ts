import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod"
import { z } from "zod"

const MODEL = "claude-sonnet-5"

const TailorSchema = z.object({
  summary: z.string(),
  selectedSkills: z.array(z.string()),
  selectedExperience: z.array(
    z.object({
      experienceId: z.string(),
      bulletIndices: z.array(z.number().int()),
    }),
  ),
  selectedProjectIds: z.array(z.string()),
  coverLetter: z.string(),
})

const QUILL_SYSTEM = `You are Quill, the application-tailoring agent for Groundwork, a personal job-search assistant. Your personality: a little bit of a perfectionist, low tolerance for cliché.

You select and reorder REAL content from the candidate's resume for a specific job posting — you never invent new experience, skills, projects, or accomplishments. You reference resume items ONLY by the exact ids/indices given to you; anything not in the resume data you're given does not exist for this task.

Write:
- A short, specific professional summary (2-3 sentences) tailored to this posting, grounded only in the resume data given.
- Which skills to surface (a relevant subset, most-relevant first) — must be exact strings from the skills list given.
- Which experience entries and which specific bullets from each (by index) best fit this posting — pick the strongest, most relevant few, not everything.
- Which 1-2 projects (if any) are most relevant to this posting.
- A cover letter (3-4 short paragraphs) grounded ONLY in the resume/profile facts given — no invented employers, degrees, dates, or achievements. Specific to this company and role, not generic. Avoid cliché openings like "I am excited to apply."`

type ExperienceInput = { id: string; company: string; title: string; bullets: string[] }
type ProjectInput = { id: string; name: string; description: string; skills: string[]; link?: string }
type ResumeInput = {
  summary: string
  experience: ExperienceInput[]
  skills: string[]
  projects: ProjectInput[]
}
type ProfileInput = { targetRoles: string[]; mustHaves: string[] }
type JobInput = { title: string; company: string; location: string; description: string }

function buildPrompt(resume: ResumeInput, profile: ProfileInput, job: JobInput): string {
  const experienceBlock = resume.experience
    .map(
      (e) =>
        `  - id: "${e.id}" | ${e.title} at ${e.company}\n` +
        e.bullets.map((b, i) => `      [${i}] ${b}`).join("\n"),
    )
    .join("\n")
  const projectsBlock = resume.projects
    .map((p) => `  - id: "${p.id}" | ${p.name}: ${p.description} (skills: ${p.skills.join(", ") || "none listed"})`)
    .join("\n")

  return [
    `JOB POSTING`,
    `Title: ${job.title}`,
    `Company: ${job.company}`,
    `Location: ${job.location}`,
    `Description: ${job.description || "(no description available)"}`,
    ``,
    `CANDIDATE'S PROFILE`,
    `Target roles: ${profile.targetRoles.join(", ") || "none set"}`,
    `Must-haves: ${profile.mustHaves.join(", ") || "none set"}`,
    ``,
    `CANDIDATE'S RESUME (the only source of truth — select/reorder from this, never invent beyond it)`,
    `Current summary: ${resume.summary || "(none written yet)"}`,
    `Skills: ${resume.skills.join(", ") || "(none listed)"}`,
    `Experience:`,
    experienceBlock || "  (none listed)",
    `Projects:`,
    projectsBlock || "  (none listed)",
    ``,
    `Tailor for this specific posting.`,
  ].join("\n")
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured on the server." }, { status: 500 })
  }

  const body = (await request.json()) as { resume: ResumeInput; profile: ProfileInput; job: JobInput }
  const client = new Anthropic({ apiKey })

  try {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 2000,
      system: QUILL_SYSTEM,
      messages: [{ role: "user", content: buildPrompt(body.resume, body.profile, body.job) }],
      output_config: { format: zodOutputFormat(TailorSchema) },
    })
    const parsed = response.parsed_output
    if (!parsed) {
      return NextResponse.json({ error: "Quill's response couldn't be parsed." }, { status: 502 })
    }

    // Resolve every selection against the REAL resume data server-side —
    // this is what makes "never invents" a structural guarantee rather
    // than just a prompt instruction. Anything the model referenced that
    // doesn't actually exist in the resume is silently dropped, not
    // trusted.
    const experienceById = new Map(body.resume.experience.map((e) => [e.id, e]))
    const resolvedExperience = parsed.selectedExperience
      .map((sel) => {
        const entry = experienceById.get(sel.experienceId)
        if (!entry) return null
        const bullets = sel.bulletIndices
          .filter((i) => i >= 0 && i < entry.bullets.length)
          .map((i) => entry.bullets[i])
        if (bullets.length === 0) return null
        return { company: entry.company, title: entry.title, bullets }
      })
      .filter((e): e is { company: string; title: string; bullets: string[] } => e !== null)

    const realSkills = new Set(body.resume.skills)
    const resolvedSkills = parsed.selectedSkills.filter((s) => realSkills.has(s))

    const projectsById = new Map(body.resume.projects.map((p) => [p.id, p]))
    const resolvedProjects = parsed.selectedProjectIds
      .map((id) => projectsById.get(id))
      .filter((p): p is ProjectInput => Boolean(p))
      .map((p) => ({ name: p.name, description: p.description, link: p.link }))

    return NextResponse.json({
      summary: parsed.summary,
      experience: resolvedExperience,
      skills: resolvedSkills,
      projects: resolvedProjects,
      coverLetter: parsed.coverLetter,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: `Tailoring failed: ${message}` }, { status: 502 })
  }
}

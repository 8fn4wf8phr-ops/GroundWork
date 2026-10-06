import { z } from "zod"
import { AgentHttpError, agentRoute, parseStructured } from "@/lib/server/agent-route"
import { findUnsupportedFigures } from "@/lib/agents/tailor-resolve"

// Herald drafts cold-outreach emails to open a door at a company — a
// distinct job from Quill's, which tailors materials to a listing already
// in hand. Herald's voice is deliberately different: warmer, more direct,
// shorter. Herald never sends: this route only returns a draft for the
// review queue (components/contacts/outreach-panel.tsx); approving it is
// a separate, explicit client action that copies to the clipboard (v1
// scope — see that component for the Microsoft Graph fast-follow note).
const HeraldSchema = z.object({
  subject: z.string(),
  body: z.string(),
  // Up to 2, same cap as Quill's project selection — matches the
  // resume.projects.max(50) below loosely; a cold email should reference
  // at most a couple of things, not the whole project bank.
  selectedProjectIds: z.array(z.string()).max(2),
  // Herald's own one-sentence case-file note, in character — generated in
  // this same call rather than a second one, same reasoning as Compass
  // narrating the score in the same pass it's computed.
  caseFileNote: z.string(),
})

const HERALD_SYSTEM = `You are Herald, the outreach-drafting agent for Groundwork, a personal job-search assistant. Your personality: warm, direct, and economical — you're opening a door, not tailoring materials to a listing already in hand. Distinct from Quill (who is a perfectionist about matching an existing posting): you write shorter, plainer, more personal notes that assume no formal application exists yet.

You draft ONE short cold-outreach email (3-4 sentences in the body, not a cover letter) to a specific person at a specific company, grounded ONLY in the resume data you're given — you never invent employers, dates, metrics, or projects beyond it. Reference at most 1-2 real projects, by name, if any genuinely fit the company/role context; if nothing fits well, it's fine to reference none. Never write a raw URL yourself — the app appends real project/portfolio links after your text, so just refer to a project by name if you mention one (e.g. "one of my recent projects, Tally, ..."), never invent or restate a link.

No generic flattery ("I've always admired your company culture"), no cliché openings ("I hope this email finds you well"), no over-explaining. Ask for one small, specific next step (a short call, a referral to the right person, feedback on fit) — not a job outright.

If the prompt says this is a FOLLOW-UP (a second touch after an earlier email got no response), write something much shorter — 1-2 sentences, not the full pitch again. A light, low-pressure bump: you're still interested, still open to that same small ask. Never re-explain who you are or re-list your background as if this were the first email.

Also write ONE short case-file note in your own voice — like a real note a teammate would read, distinct from the email itself — mentioning who you drafted for and, if relevant, which project you cited.`

const short = z.string().max(300)
const RequestSchema = z.object({
  resume: z.object({
    summary: z.string().max(5000),
    projects: z
      .array(
        z.object({
          id: z.string().max(128),
          name: short,
          description: z.string().max(3000),
          skills: z.array(z.string().max(100)).max(50),
          link: z
            .string()
            .max(500)
            .nullish()
            .transform((v) => v ?? undefined),
        }),
      )
      .max(50),
    portfolioUrl: z
      .string()
      .max(500)
      .nullish()
      .transform((v) => v ?? undefined),
  }),
  targetRoles: z.array(z.string().max(200)).max(20),
  company: short,
  contactName: short,
  contactEmail: z.string().email().max(320).optional(),
  // Free text only — never a URL this route fetches (spec guardrail: no
  // scraping, contact/context info is supplied manually).
  roleContext: z.string().max(3000).optional(),
  // Present only when this draft is a second touch (outreach-detail-modal.tsx
  // calls this automatically when an Outreach's status moves to "Follow-up
  // due") — steers the model toward a short bump instead of a fresh pitch,
  // per the HERALD_SYSTEM instruction above. Absent for the normal
  // first-touch draft (outreach-panel.tsx).
  followUp: z.object({ daysSinceFirstTouch: z.number().int().min(0).max(3650) }).optional(),
})
type RequestBody = z.infer<typeof RequestSchema>
type ResumeInput = RequestBody["resume"]

function buildPrompt(body: RequestBody): string {
  const projectsBlock = body.resume.projects
    .map((p) => `  - id: "${p.id}" | ${p.name}: ${p.description} (skills: ${p.skills.join(", ") || "none listed"})`)
    .join("\n")

  return [
    `TARGET`,
    `Company: ${body.company}`,
    `Contact: ${body.contactName}`,
    body.roleContext ? `Role/context provided: ${body.roleContext}` : `Role/context provided: (none — general cold outreach)`,
    body.followUp
      ? `\nFOLLOW-UP CONTEXT\nThis is a second touch, ${body.followUp.daysSinceFirstTouch} day${body.followUp.daysSinceFirstTouch === 1 ? "" : "s"} after an initial cold email to this same contact that got no response. Keep it short per your instructions.`
      : ``,
    ``,
    `CANDIDATE'S PROFILE`,
    `Target roles: ${body.targetRoles.join(", ") || "none set"}`,
    `Summary: ${body.resume.summary || "(none written yet)"}`,
    `Projects (reference by name only, never invent one not listed):`,
    projectsBlock || "  (none listed)",
    ``,
    `Draft the outreach email and the case-file note.`,
  ].join("\n")
}

function resolveProjects(ids: string[], projects: ResumeInput["projects"]) {
  const byId = new Map(projects.map((p) => [p.id, p]))
  const seen = new Set<string>()
  const resolved: ResumeInput["projects"] = []
  for (const id of ids) {
    const p = byId.get(id)
    if (p && !seen.has(p.id)) {
      seen.add(p.id)
      resolved.push(p)
    }
  }
  return resolved.slice(0, 2)
}

export const POST = agentRoute({ name: "Herald draft", schema: RequestSchema }, async ({ client, body }) => {
  const parsed = await parseStructured(client, {
    system: HERALD_SYSTEM,
    prompt: buildPrompt(body),
    // Confirmed live: 1000 truncated mid-JSON even for Herald's much
    // shorter output (a few sentences + a one-line case-file note) — same
    // failure mode as Quill's tailor route (JOURNEY.md §24), just at a
    // smaller scale. Structured-output overhead eats more of the budget
    // than the visible text alone would suggest.
    maxTokens: 2000,
    schema: HeraldSchema,
  })
  if (!parsed) throw new AgentHttpError(502, "Herald's response couldn't be parsed.")

  // Resolved server-side against the real Resume, never trusted verbatim
  // from the model — same discipline as Quill's project selection
  // (lib/agents/tailor-resolve.ts).
  const resolvedProjects = resolveProjects(parsed.selectedProjectIds, body.resume.projects)

  // Real links are appended here, deterministically, rather than asked of
  // the model — a model reproducing a URL verbatim is exactly the kind of
  // thing that can quietly drift wrong.
  const linkLines = resolvedProjects.filter((p) => p.link).map((p) => `${p.name}: ${p.link}`)
  if (body.resume.portfolioUrl) linkLines.push(`Portfolio: ${body.resume.portfolioUrl}`)
  const finalBody = linkLines.length > 0 ? `${parsed.body}\n\n${linkLines.join("\n")}` : parsed.body

  const sourceText = [
    body.resume.summary,
    ...body.resume.projects.flatMap((p) => [p.name, p.description, ...p.skills]),
    ...body.targetRoles,
    body.company,
    body.contactName,
    body.roleContext ?? "",
  ].join("\n")
  const warnings = findUnsupportedFigures(`${parsed.subject}\n${parsed.body}`, sourceText)

  return {
    subject: parsed.subject,
    body: finalBody,
    projectsReferenced: resolvedProjects.map((p) => p.name),
    warnings,
    caseFileNote: parsed.caseFileNote,
  }
})

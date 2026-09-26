import { postAgent } from "@/lib/agents/client"
import type { Resume } from "@/lib/types"

export type HeraldDraft = {
  subject: string
  body: string
  projectsReferenced: string[]
  warnings: string[]
  caseFileNote: string
}

export async function draftOutreach(
  resume: Resume,
  targetRoles: string[],
  args: { company: string; contactName: string; contactEmail?: string; roleContext?: string },
): Promise<HeraldDraft> {
  return postAgent<HeraldDraft>(
    "/api/agents/herald-draft",
    {
      resume: {
        summary: resume.summary,
        projects: resume.projects.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          skills: p.skills,
          link: p.link,
        })),
        portfolioUrl: resume.portfolioUrl,
      },
      targetRoles,
      company: args.company,
      contactName: args.contactName,
      contactEmail: args.contactEmail,
      roleContext: args.roleContext,
    },
    "Herald draft",
  )
}

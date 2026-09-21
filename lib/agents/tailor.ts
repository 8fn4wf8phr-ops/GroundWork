import type { Job, Profile, Resume } from "@/lib/types"
import type { NewTailoredMaterials } from "@/lib/firestore/tailored-materials"
import { clip, postAgent } from "@/lib/agents/client"

export async function tailorForJob(
  resume: Resume,
  profile: Profile,
  job: Job,
  applicationId: string,
): Promise<NewTailoredMaterials> {
  const result = await postAgent<Omit<NewTailoredMaterials, "applicationId" | "jobId">>(
    "/api/agents/tailor",
    {
      resume: {
        summary: resume.summary,
        experience: resume.experience.map((e) => ({
          id: e.id,
          company: e.company,
          title: e.title,
          bullets: e.bullets,
        })),
        skills: resume.skills,
        projects: resume.projects.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          skills: p.skills,
          link: p.link,
        })),
      },
      profile: { targetRoles: profile.targetRoles, mustHaves: profile.mustHaves },
      job: {
        title: clip(job.title, 300),
        company: clip(job.company, 300),
        location: clip(job.location, 300),
        // Third-party postings can be arbitrarily long; the route caps the
        // description, so trim here rather than have the whole request rejected.
        description: clip(job.description ?? "", 20000),
      },
    },
    "Tailoring",
  )
  return { ...result, applicationId, jobId: job.id }
}

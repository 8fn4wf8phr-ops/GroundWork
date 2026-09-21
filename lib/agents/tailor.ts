import type { Job, Profile, Resume } from "@/lib/types"
import type { NewTailoredMaterials } from "@/lib/firestore/tailored-materials"

export async function tailorForJob(
  resume: Resume,
  profile: Profile,
  job: Job,
  applicationId: string,
): Promise<NewTailoredMaterials> {
  const res = await fetch("/api/agents/tailor", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
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
      job: { title: job.title, company: job.company, location: job.location, description: job.description ?? "" },
    }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Tailoring returned ${res.status}`)
  }
  const result = await res.json()
  return { ...result, applicationId, jobId: job.id }
}

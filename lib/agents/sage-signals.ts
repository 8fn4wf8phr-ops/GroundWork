import type { Profile, Resume } from "@/lib/types"

// Sage's "checks in periodically" role (spec §7), scoped to two genuine,
// objective gaps between Profile and Resume — deliberately not fuzzy
// judgments like "your experience doesn't match your seniority target,"
// which would be presumptuous to assert from field values alone.
export type SageSignal =
  | { type: "no_experience"; targetRoles: string[] }
  | { type: "no_target_roles" }

export function detectSageSignal(profile: Profile, resume: Resume | null): SageSignal | null {
  const hasTargetRoles = profile.targetRoles.length > 0
  const hasExperience = Boolean(resume && resume.experience.length > 0)
  if (hasTargetRoles && !hasExperience) return { type: "no_experience", targetRoles: profile.targetRoles }
  if (!hasTargetRoles && hasExperience) return { type: "no_target_roles" }
  return null
}

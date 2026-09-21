"use client"

import { useEffect, useState } from "react"
import { colors } from "@/lib/theme"
import { useAuth } from "@/lib/auth-context"
import { useResume } from "@/lib/hooks/use-resume"
import { saveResume } from "@/lib/firestore/resume"
import TagListInput from "@/components/profile/tag-list-input"
import ExperienceEditor from "@/components/resume/experience-editor"
import EducationEditor from "@/components/resume/education-editor"
import CertificationEditor from "@/components/resume/certification-editor"
import ProjectEditor from "@/components/resume/project-editor"
import { fetchPortfolioProjects, mergePortfolioProjects } from "@/lib/resume/portfolio-sync"
import type { CertificationEntry, EducationEntry, ExperienceEntry, ProjectEntry } from "@/lib/types"

export default function ResumeView() {
  const { user } = useAuth()
  const { resume, loading } = useResume()

  const [summary, setSummary] = useState("")
  const [experience, setExperience] = useState<ExperienceEntry[]>([])
  const [skills, setSkills] = useState<string[]>([])
  const [education, setEducation] = useState<EducationEntry[]>([])
  const [certifications, setCertifications] = useState<CertificationEntry[]>([])
  const [projects, setProjects] = useState<ProjectEntry[]>([])
  const [portfolioUrl, setPortfolioUrl] = useState("")
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  // Same seed-once pattern as ProfileView — after the initial load, the
  // form owns its own state so typing doesn't get clobbered by the live
  // listener re-firing.
  const [seeded, setSeeded] = useState(false)
  useEffect(() => {
    if (loading || seeded) return
    if (resume) {
      setSummary(resume.summary)
      setExperience(resume.experience)
      setSkills(resume.skills)
      setEducation(resume.education)
      setCertifications(resume.certifications)
      setProjects(resume.projects)
      setPortfolioUrl(resume.portfolioUrl ?? "")
    }
    setSeeded(true)
  }, [loading, seeded, resume])

  const syncPortfolio = async () => {
    if (!portfolioUrl.trim()) return
    setSyncing(true)
    setSyncMessage(null)
    try {
      const fetched = await fetchPortfolioProjects(portfolioUrl)
      setProjects((prev) => mergePortfolioProjects(prev, fetched))
      setSyncMessage(
        `Synced ${fetched.length} project${fetched.length === 1 ? "" : "s"} from your portfolio — remember to save.`,
      )
    } catch (err) {
      setSyncMessage(err instanceof Error ? `Couldn't sync: ${err.message}` : "Couldn't reach that portfolio site.")
    } finally {
      setSyncing(false)
    }
  }

  const save = async () => {
    if (!user) return
    setSaving(true)
    setError(null)
    try {
      await saveResume(user.uid, {
        summary,
        experience,
        skills,
        education,
        certifications,
        projects,
        portfolioUrl: portfolioUrl || undefined,
      })
      setSavedAt(Date.now())
    } catch {
      setError("Couldn't save your resume. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  if (loading || !seeded) {
    return (
      <div className="p-6 text-sm" style={{ color: colors.muted }}>
        Loading…
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-2xl p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold" style={{ color: colors.text, fontFamily: "var(--font-space-grotesk)" }}>
          Resume
        </h2>
        <p className="mt-1 text-sm" style={{ color: colors.muted }}>
          Structured, not a file — bullets, skills, and projects are stored individually so Quill can select and
          reorder them per posting rather than rewriting from scratch (spec §4).
        </p>
      </div>

      <div className="flex flex-col gap-6 rounded-xl border p-6" style={{ borderColor: colors.border, backgroundColor: colors.panel }}>
        <label className="flex flex-col gap-1.5 text-sm">
          <span style={{ color: colors.muted }}>Professional summary</span>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={3}
            placeholder="A short summary — this gets rewritten per job at application time."
            className="rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
            style={{ borderColor: colors.border, color: colors.text }}
          />
        </label>

        <TagListInput
          label="Skills"
          placeholder="e.g. TypeScript, React, Firebase — press Enter to add"
          values={skills}
          onChange={setSkills}
        />

        <ExperienceEditor entries={experience} onChange={setExperience} />
        <EducationEditor entries={education} onChange={setEducation} />
        <CertificationEditor entries={certifications} onChange={setCertifications} />
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1.5 text-sm">
            <span style={{ color: colors.muted }}>Portfolio site URL (optional)</span>
            <div className="flex gap-2">
              <input
                value={portfolioUrl}
                onChange={(e) => setPortfolioUrl(e.target.value)}
                placeholder="https://yourportfolio.com"
                className="flex-1 rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
                style={{ borderColor: colors.border, color: colors.text }}
              />
              <button
                type="button"
                onClick={syncPortfolio}
                disabled={syncing || !portfolioUrl.trim()}
                className="shrink-0 rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:opacity-90 disabled:opacity-50"
                style={{ borderColor: colors.border, color: colors.text }}
              >
                {syncing ? "Syncing…" : "Sync from portfolio"}
              </button>
            </div>
          </label>
          <p className="text-xs" style={{ color: colors.muted }}>
            Fetches {"{portfolioUrl}"}/projects.json (spec §16) — shipping a new project to your site makes it
            available here without re-entering it. Re-syncing updates matching projects in place.
          </p>
          {syncMessage && (
            <p className="text-xs" style={{ color: colors.teal }}>
              {syncMessage}
            </p>
          )}
        </div>

        <ProjectEditor entries={projects} onChange={setProjects} />

        {error && (
          <p className="text-sm" style={{ color: colors.amber }}>
            {error}
          </p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-lg px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: colors.teal, color: colors.bg }}
          >
            {saving ? "Saving…" : "Save resume"}
          </button>
          {savedAt && !saving && (
            <span className="text-sm" style={{ color: colors.muted }}>
              Saved
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

"use client"

import { useEffect, useState } from "react"
import { colors } from "@/lib/theme"
import { useAuth } from "@/lib/auth-context"
import { useResume } from "@/lib/hooks/use-resume"
import { useProfile } from "@/lib/hooks/use-profile"
import { getTailoredMaterials, saveTailoredMaterials, saveEditedCoverLetter } from "@/lib/firestore/tailored-materials"
import { updateApplication } from "@/lib/firestore/applications"
import { tailorForJob } from "@/lib/agents/tailor"
import type { ApplicationWithJob, TailoredMaterials } from "@/lib/types"

export default function TailorMaterialsModal({
  application,
  onClose,
}: {
  application: ApplicationWithJob
  onClose: () => void
}) {
  const { user } = useAuth()
  const { resume, loading: resumeLoading } = useResume()
  const { profile, loading: profileLoading } = useProfile()

  const [materials, setMaterials] = useState<TailoredMaterials | null>(null)
  const [loadingMaterials, setLoadingMaterials] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [coverLetterDraft, setCoverLetterDraft] = useState("")
  const [savingEdit, setSavingEdit] = useState(false)

  useEffect(() => {
    if (!user) return
    getTailoredMaterials(user.uid, application.id)
      .then((m) => {
        setMaterials(m)
        setCoverLetterDraft(m ? (m.editedCoverLetter ?? m.coverLetter) : "")
      })
      .finally(() => setLoadingMaterials(false))
  }, [user, application.id])

  const generate = async () => {
    if (!user || !resume || !profile || !application.job) return
    setGenerating(true)
    setError(null)
    try {
      const result = await tailorForJob(resume, profile, application.job, application.id)
      await saveTailoredMaterials(user.uid, result)
      const saved = await getTailoredMaterials(user.uid, application.id)
      setMaterials(saved)
      setCoverLetterDraft(saved ? (saved.editedCoverLetter ?? saved.coverLetter) : "")
      await updateApplication(application.id, {
        resumeVersionUsed: `Tailored ${new Date().toISOString().slice(0, 10)}`,
        coverLetterUsed: `Tailored ${new Date().toISOString().slice(0, 10)}`,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't generate tailored materials. Please try again.")
    } finally {
      setGenerating(false)
    }
  }

  const saveEdit = async () => {
    if (!materials) return
    setSavingEdit(true)
    try {
      await saveEditedCoverLetter(materials.id, coverLetterDraft)
      setMaterials({ ...materials, editedCoverLetter: coverLetterDraft })
    } finally {
      setSavingEdit(false)
    }
  }

  const hasEmptyResume =
    !resumeLoading && (!resume || (resume.experience.length === 0 && resume.skills.length === 0))
  const coverLetterChanged = materials && coverLetterDraft !== (materials.editedCoverLetter ?? materials.coverLetter)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl border p-6"
        style={{ borderColor: colors.border, backgroundColor: colors.panel }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold" style={{ color: colors.text }}>
              Tailored materials
            </h2>
            <p className="text-sm" style={{ color: colors.muted }}>
              {application.job?.title ?? "Untitled role"} · {application.job?.company ?? "Unknown company"}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-sm" style={{ color: colors.muted }} aria-label="Close">
            Close
          </button>
        </div>

        {hasEmptyResume ? (
          <p className="mt-4 text-sm" style={{ color: colors.amber }}>
            Your Resume is empty — add your experience and skills first so Quill has real content to select from.
          </p>
        ) : loadingMaterials || resumeLoading || profileLoading ? (
          <p className="mt-4 text-sm" style={{ color: colors.muted }}>
            Loading…
          </p>
        ) : (
          <div className="mt-4 flex flex-col gap-5">
            <button
              type="button"
              disabled={generating}
              onClick={generate}
              className="self-start rounded-lg px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: colors.teal, color: colors.bg }}
            >
              {generating ? "Quill is drafting…" : materials ? "Regenerate" : "Generate tailored materials"}
            </button>

            {error && (
              <p className="text-sm" style={{ color: colors.amber }}>
                {error}
              </p>
            )}

            {materials && (
              <>
                <div>
                  <span className="text-xs font-medium uppercase tracking-wide" style={{ color: colors.muted }}>
                    Summary
                  </span>
                  <p className="mt-1.5 text-sm leading-relaxed" style={{ color: colors.text }}>
                    {materials.summary}
                  </p>
                </div>

                {materials.skills.length > 0 && (
                  <div>
                    <span className="text-xs font-medium uppercase tracking-wide" style={{ color: colors.muted }}>
                      Skills surfaced
                    </span>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {materials.skills.map((s) => (
                        <span
                          key={s}
                          className="rounded-md px-2 py-0.5 text-xs font-medium"
                          style={{ color: colors.teal, backgroundColor: "rgba(53,201,193,0.12)" }}
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {materials.experience.length > 0 && (
                  <div>
                    <span className="text-xs font-medium uppercase tracking-wide" style={{ color: colors.muted }}>
                      Experience selected
                    </span>
                    <div className="mt-1.5 flex flex-col gap-3">
                      {materials.experience.map((e, i) => (
                        <div key={i}>
                          <p className="text-sm font-semibold" style={{ color: colors.text }}>
                            {e.title} · {e.company}
                          </p>
                          <ul className="mt-1 flex flex-col gap-1">
                            {e.bullets.map((b, j) => (
                              <li key={j} className="flex items-start gap-2 text-sm" style={{ color: colors.text }}>
                                <span
                                  className="mt-1.5 h-1 w-1 shrink-0 rounded-full"
                                  style={{ backgroundColor: colors.muted }}
                                />
                                <span>{b}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {materials.projects.length > 0 && (
                  <div>
                    <span className="text-xs font-medium uppercase tracking-wide" style={{ color: colors.muted }}>
                      Projects selected
                    </span>
                    <div className="mt-1.5 flex flex-col gap-2">
                      {materials.projects.map((p, i) => (
                        <p key={i} className="text-sm" style={{ color: colors.text }}>
                          <span className="font-semibold">{p.name}</span> — {p.description}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="text-xs font-medium uppercase tracking-wide" style={{ color: colors.muted }}>
                    Cover letter (editable)
                  </span>
                  <textarea
                    value={coverLetterDraft}
                    onChange={(e) => setCoverLetterDraft(e.target.value)}
                    rows={10}
                    className="rounded-lg border bg-transparent px-3 py-2 text-sm leading-relaxed outline-none"
                    style={{ borderColor: colors.border, color: colors.text }}
                  />
                  {coverLetterChanged && (
                    <button
                      type="button"
                      onClick={saveEdit}
                      disabled={savingEdit}
                      className="self-start rounded-md border px-3 py-1.5 text-sm font-medium transition-colors hover:opacity-90 disabled:opacity-50"
                      style={{ borderColor: colors.border, color: colors.text }}
                    >
                      {savingEdit ? "Saving…" : "Save edits"}
                    </button>
                  )}
                </label>

                <p className="text-xs" style={{ color: colors.muted }}>
                  Staged for your review — nothing here gets submitted automatically. Copy what you need into the
                  employer's actual application.
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

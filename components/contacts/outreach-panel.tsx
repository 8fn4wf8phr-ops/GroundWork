"use client"

import { useState } from "react"
import { colors } from "@/lib/theme"
import { useAuth } from "@/lib/auth-context"
import { useResume } from "@/lib/hooks/use-resume"
import { useProfile } from "@/lib/hooks/use-profile"
import { useApplications } from "@/lib/hooks/use-applications"
import { useOutreach } from "@/lib/hooks/use-outreach"
import { createOutreach } from "@/lib/firestore/outreach"
import { createCaseFileEntries } from "@/lib/firestore/case-file"
import { draftOutreach } from "@/lib/agents/herald"
import { clip } from "@/lib/clip"
import OutreachDetailModal from "@/components/contacts/outreach-detail-modal"
import type { Contact, Outreach } from "@/lib/types"

const STATUS_TONE: Record<Outreach["status"], string> = {
  Drafted: colors.muted,
  Sent: colors.teal,
  Responded: colors.teal,
  "Follow-up due": colors.amber,
  "No response": colors.muted,
}

export default function OutreachPanel({ contact }: { contact: Contact }) {
  const { user } = useAuth()
  const { resume, loading: resumeLoading } = useResume()
  const { profile } = useProfile()
  const { applications } = useApplications()
  const { outreach } = useOutreach()

  const forContact = outreach
    .filter((o) => o.contactId === contact.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const linkedApps = applications.filter((a) => contact.applicationIds.includes(a.id) && a.job)

  const [showDraftForm, setShowDraftForm] = useState(false)
  const [company, setCompany] = useState(linkedApps[0]?.job?.company ?? "")
  const [applicationId, setApplicationId] = useState<string>(linkedApps[0]?.id ?? "")
  const [roleContext, setRoleContext] = useState("")
  const [postingUrl, setPostingUrl] = useState("")
  const [drafting, setDrafting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Outreach | null>(null)

  const pickApplication = (id: string) => {
    setApplicationId(id)
    const app = linkedApps.find((a) => a.id === id)
    if (app?.job) {
      setCompany(app.job.company)
      setRoleContext(`${app.job.title}${app.job.description ? ` — ${clip(app.job.description, 500)}` : ""}`)
    }
  }

  const draft = async () => {
    if (!user || !resume || !profile || !company.trim()) return
    setDrafting(true)
    setError(null)
    try {
      const result = await draftOutreach(resume, profile.targetRoles, {
        company: company.trim(),
        contactName: contact.name,
        contactEmail: contact.email,
        roleContext: roleContext.trim() || undefined,
      })
      const id = await createOutreach(user.uid, {
        contactId: contact.id,
        applicationId: applicationId || undefined,
        company: company.trim(),
        contactName: contact.name,
        contactEmail: contact.email,
        roleContext: roleContext.trim() || undefined,
        postingUrl: postingUrl.trim() || undefined,
        subject: result.subject,
        body: result.body,
        projectsReferenced: result.projectsReferenced,
        warnings: result.warnings,
        status: "Drafted",
      })
      await createCaseFileEntries(user.uid, [{ agent: "Herald", message: result.caseFileNote, outreachId: id }])
      setShowDraftForm(false)
      setRoleContext("")
      setPostingUrl("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reach Herald right now.")
    } finally {
      setDrafting(false)
    }
  }

  const hasEmptyResume = !resumeLoading && (!resume || (!resume.summary && resume.projects.length === 0))

  return (
    <div className="mt-5 border-t pt-4" style={{ borderColor: colors.border }}>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold" style={{ color: colors.text }}>
          Outreach
        </h3>
        {!showDraftForm && (
          <button
            type="button"
            onClick={() => setShowDraftForm(true)}
            className="text-sm underline underline-offset-2"
            style={{ color: colors.teal }}
          >
            + Draft with Herald
          </button>
        )}
      </div>

      {showDraftForm && (
        <div className="mb-3 flex flex-col gap-2.5 rounded-lg border p-3" style={{ borderColor: colors.border }}>
          {hasEmptyResume ? (
            <p className="text-sm" style={{ color: colors.amber }}>
              Your Resume is empty — add a summary or a project first so Herald has real content to draw from.
            </p>
          ) : (
            <>
              <label className="flex flex-col gap-1 text-sm">
                <span style={{ color: colors.muted }}>Company</span>
                <input
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
                  style={{ borderColor: colors.border, color: colors.text }}
                />
              </label>
              {linkedApps.length > 0 && (
                <label className="flex flex-col gap-1 text-sm">
                  <span style={{ color: colors.muted }}>Link to an application (optional)</span>
                  <select
                    value={applicationId}
                    onChange={(e) => pickApplication(e.target.value)}
                    className="rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
                    style={{ borderColor: colors.border, color: colors.text }}
                  >
                    <option value="">None</option>
                    {linkedApps.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.job?.title} at {a.job?.company}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="flex flex-col gap-1 text-sm">
                <span style={{ color: colors.muted }}>Role/context (optional)</span>
                <textarea
                  value={roleContext}
                  onChange={(e) => setRoleContext(e.target.value)}
                  rows={2}
                  placeholder="A specific role, or just what you know about the team — typed in, not pulled from a link"
                  className="rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
                  style={{ borderColor: colors.border, color: colors.text }}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span style={{ color: colors.muted }}>Posting URL (optional — for your own reference only)</span>
                <input
                  value={postingUrl}
                  onChange={(e) => setPostingUrl(e.target.value)}
                  placeholder="Not fetched — Herald never scrapes a link"
                  className="rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
                  style={{ borderColor: colors.border, color: colors.text }}
                />
              </label>
              {error && (
                <p className="text-sm" style={{ color: colors.amber }}>
                  {error}
                </p>
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={drafting || !company.trim()}
                  onClick={draft}
                  className="rounded-lg px-3 py-1.5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
                  style={{ backgroundColor: colors.teal, color: colors.bg }}
                >
                  {drafting ? "Herald is drafting…" : "Draft with Herald"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowDraftForm(false)}
                  className="text-sm"
                  style={{ color: colors.muted }}
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {forContact.length === 0 ? (
        <p className="text-sm" style={{ color: colors.muted }}>
          No outreach drafted yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {forContact.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => setSelected(o)}
                className="w-full rounded-lg border px-3 py-2 text-left transition-colors hover:opacity-90"
                style={{ borderColor: colors.border, backgroundColor: colors.card }}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-sm font-medium" style={{ color: colors.text }}>
                    {o.subject}
                  </span>
                  <span className="shrink-0 text-xs font-semibold" style={{ color: STATUS_TONE[o.status] }}>
                    {o.status}
                  </span>
                </div>
                <span className="text-xs" style={{ color: colors.muted }}>
                  {o.company} · {o.createdAt.slice(0, 10)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected && <OutreachDetailModal outreach={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

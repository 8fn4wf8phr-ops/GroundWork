"use client"

import { useState } from "react"
import { colors } from "@/lib/theme"
import { useAuth } from "@/lib/auth-context"
import { useProfile } from "@/lib/hooks/use-profile"
import { useOutreach } from "@/lib/hooks/use-outreach"
import { deleteOutreach, updateOutreach } from "@/lib/firestore/outreach"
import { createCaseFileEntries } from "@/lib/firestore/case-file"
import { logStatusChange } from "@/lib/agents/ledger"
import { OUTREACH_STATUSES, type Outreach, type OutreachStatus } from "@/lib/types"

const DEFAULT_DAILY_CAP = 10

export default function OutreachDetailModal({ outreach, onClose }: { outreach: Outreach; onClose: () => void }) {
  const { user } = useAuth()
  const { profile } = useProfile()
  const { outreach: allOutreach } = useOutreach()

  const [subject, setSubject] = useState(outreach.subject)
  const [body, setBody] = useState(outreach.body)
  const [status, setStatus] = useState<OutreachStatus>(outreach.status)
  const [followUpDate, setFollowUpDate] = useState(outreach.followUpDate ?? "")
  const [notes, setNotes] = useState(outreach.notes ?? "")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedWhat, setCopiedWhat] = useState<string | null>(null)
  const [confirmOverCap, setConfirmOverCap] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const cap = profile?.outreachDailyCap ?? DEFAULT_DAILY_CAP
  const today = new Date().toISOString().slice(0, 10)
  const sentToday = allOutreach.filter((o) => o.sentAt?.slice(0, 10) === today).length
  const wouldExceedCap = outreach.sentAt?.slice(0, 10) !== today && sentToday >= cap

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedWhat(label)
      setTimeout(() => setCopiedWhat(null), 2000)
    } catch {
      setError("Couldn't copy to clipboard — your browser may be blocking it.")
    }
  }

  const persist = async (nextStatus: OutreachStatus) => {
    setSaving(true)
    setError(null)
    const oldStatus = outreach.status
    try {
      const movingToSent = oldStatus !== "Sent" && nextStatus === "Sent"
      await updateOutreach(outreach.id, {
        subject,
        body,
        status: nextStatus,
        followUpDate: followUpDate || undefined,
        notes: notes || undefined,
        ...(movingToSent && !outreach.sentAt ? { sentAt: new Date().toISOString() } : {}),
      })
      if (nextStatus !== oldStatus && user) {
        // Ledger's log is a bonus layer on the real, already-saved status
        // change — a failure here shouldn't block closing the modal or
        // hide that the save itself succeeded. Same agent, same route as
        // Application status logging (app/api/agents/ledger-log) — Ledger
        // is extended here, not duplicated.
        try {
          const message = await logStatusChange(outreach.company, `Outreach to ${outreach.contactName}`, oldStatus, nextStatus)
          await createCaseFileEntries(user.uid, [{ agent: "Ledger", message, outreachId: outreach.id }])
        } catch {
          // ignore — see comment above
        }
      }
      setStatus(nextStatus)
      setConfirmOverCap(false)
    } catch {
      setError("Couldn't save those changes. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const save = () => persist(status)

  const approveAndCopy = async () => {
    if (wouldExceedCap && !confirmOverCap) {
      setConfirmOverCap(true)
      return
    }
    await copy(body, "body")
    await persist("Sent")
  }

  const remove = async () => {
    setDeleting(true)
    try {
      await deleteOutreach(outreach.id)
      onClose()
    } catch {
      setError("Couldn't delete this draft. Please try again.")
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-xl border p-6"
        style={{ borderColor: colors.border, backgroundColor: colors.panel }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold" style={{ color: colors.text }}>
              Outreach — {outreach.contactName}
            </h2>
            <p className="text-sm" style={{ color: colors.muted }}>
              {outreach.company}
              {outreach.contactEmail ? ` · ${outreach.contactEmail}` : ""}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-sm" style={{ color: colors.muted }} aria-label="Close">
            Close
          </button>
        </div>

        <div className="flex flex-col gap-3.5">
          {outreach.projectsReferenced.length > 0 && (
            <p className="text-xs" style={{ color: colors.muted }}>
              References: {outreach.projectsReferenced.join(", ")}
            </p>
          )}

          {outreach.warnings && outreach.warnings.length > 0 && (
            <div className="rounded-lg border px-3 py-2" style={{ borderColor: colors.amber }}>
              <span className="text-xs font-medium uppercase tracking-wide" style={{ color: colors.amber }}>
                Check before sending
              </span>
              <ul className="mt-1 flex flex-col gap-1 text-sm" style={{ color: colors.text }}>
                {outreach.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          <label className="flex flex-col gap-1.5 text-sm">
            <div className="flex items-center justify-between">
              <span style={{ color: colors.muted }}>Subject</span>
              <button type="button" onClick={() => copy(subject, "subject")} className="text-xs underline underline-offset-2" style={{ color: colors.teal }}>
                {copiedWhat === "subject" ? "Copied" : "Copy"}
              </button>
            </div>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
              style={{ borderColor: colors.border, color: colors.text }}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <div className="flex items-center justify-between">
              <span style={{ color: colors.muted }}>Body</span>
              <button type="button" onClick={() => copy(body, "body")} className="text-xs underline underline-offset-2" style={{ color: colors.teal }}>
                {copiedWhat === "body" ? "Copied" : "Copy"}
              </button>
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              className="rounded-lg border bg-transparent px-3 py-2 text-sm leading-relaxed outline-none"
              style={{ borderColor: colors.border, color: colors.text }}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 text-sm">
              <span style={{ color: colors.muted }}>Status</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as OutreachStatus)}
                className="rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
                style={{ borderColor: colors.border, color: colors.text }}
              >
                {OUTREACH_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span style={{ color: colors.muted }}>Follow-up date</span>
              <input
                type="date"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
                className="rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
                style={{ borderColor: colors.border, color: colors.text }}
              />
            </label>
          </div>

          <label className="flex flex-col gap-1.5 text-sm">
            <span style={{ color: colors.muted }}>Notes</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
              style={{ borderColor: colors.border, color: colors.text }}
            />
          </label>

          {confirmOverCap && (
            <p className="text-sm" style={{ color: colors.amber }}>
              You've already approved {sentToday} outreach message{sentToday === 1 ? "" : "s"} today — your soft cap
              is {cap}. Click "Approve & copy" again to send anyway.
            </p>
          )}

          {error && (
            <p className="text-sm" style={{ color: colors.amber }}>
              {error}
            </p>
          )}

          <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
            {confirmingDelete ? (
              <div className="flex items-center gap-2 text-sm">
                <span style={{ color: colors.muted }}>Discard this draft?</span>
                <button
                  type="button"
                  onClick={remove}
                  disabled={deleting}
                  className="font-medium underline underline-offset-2 disabled:opacity-60"
                  style={{ color: colors.amber }}
                >
                  {deleting ? "Discarding…" : "Confirm"}
                </button>
                <button type="button" onClick={() => setConfirmingDelete(false)} className="underline underline-offset-2" style={{ color: colors.muted }}>
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="text-sm underline underline-offset-2"
                style={{ color: colors.muted }}
              >
                Discard draft
              </button>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:opacity-90 disabled:opacity-50"
                style={{ borderColor: colors.border, color: colors.text }}
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
              <button
                type="button"
                onClick={approveAndCopy}
                disabled={saving}
                className="rounded-lg px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: colors.teal, color: colors.bg }}
              >
                Approve & copy
              </button>
            </div>
          </div>

          <p className="text-xs" style={{ color: colors.muted }}>
            Herald never sends anything — "Approve & copy" copies the body to your clipboard and marks this Sent, for
            you to paste into Outlook yourself. (A direct Outlook send via Microsoft Graph is a planned fast-follow,
            not built yet.)
          </p>
        </div>
      </div>
    </div>
  )
}

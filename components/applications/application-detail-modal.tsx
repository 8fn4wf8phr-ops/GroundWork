"use client"

import { useState } from "react"
import { colors } from "@/lib/theme"
import { deleteApplication, updateApplication } from "@/lib/firestore/applications"
import { linkContactToApplication, unlinkContactFromApplication } from "@/lib/firestore/contacts"
import { useContacts } from "@/lib/hooks/use-contacts"
import { APPLICATION_STATUSES, CHANNELS, type ApplicationStatus, type ApplicationWithJob, type Channel } from "@/lib/types"

export default function ApplicationDetailModal({
  application,
  onClose,
}: {
  application: ApplicationWithJob
  onClose: () => void
}) {
  const [status, setStatus] = useState<ApplicationStatus>(application.status)
  const [channel, setChannel] = useState<Channel | "">(application.channel ?? "")
  const [appliedDate, setAppliedDate] = useState(application.appliedDate ?? "")
  const [followUpDate, setFollowUpDate] = useState(application.followUpDate ?? "")
  const [rejectionReason, setRejectionReason] = useState(application.rejectionReason ?? "")
  const [notes, setNotes] = useState(application.notes ?? "")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const { contacts } = useContacts()
  const [linkingContactId, setLinkingContactId] = useState("")
  const linkedContacts = contacts.filter((c) => c.applicationIds.includes(application.id))
  const unlinkedContacts = contacts.filter((c) => !c.applicationIds.includes(application.id))

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      await updateApplication(application.id, {
        status,
        channel: channel || undefined,
        appliedDate: appliedDate || undefined,
        followUpDate: followUpDate || undefined,
        rejectionReason: rejectionReason || undefined,
        notes: notes || undefined,
      })
      onClose()
    } catch {
      setError("Couldn't save those changes. Please try again.")
      setSaving(false)
    }
  }

  const remove = async () => {
    setDeleting(true)
    try {
      await deleteApplication(application.id, application.jobId, application.job?.source ?? "manual")
      onClose()
    } catch {
      setError("Couldn't delete this application. Please try again.")
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl border p-6"
        style={{ borderColor: colors.border, backgroundColor: colors.panel }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold" style={{ color: colors.text }}>
              {application.job?.title ?? "Untitled role"}
            </h2>
            <p className="text-sm" style={{ color: colors.muted }}>
              {application.job?.company ?? "Unknown company"}
              {application.job?.location ? ` · ${application.job.location}` : ""}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-sm" style={{ color: colors.muted }} aria-label="Close">
            Close
          </button>
        </div>

        {application.job?.postingUrl && (
          <a
            href={application.job.postingUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-block text-sm underline underline-offset-2"
            style={{ color: colors.teal }}
          >
            View posting
          </a>
        )}

        <div className="mt-4 flex flex-col gap-3.5">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 text-sm">
              <span style={{ color: colors.muted }}>Status</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ApplicationStatus)}
                className="rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
                style={{ borderColor: colors.border, color: colors.text, backgroundColor: colors.panel }}
              >
                {APPLICATION_STATUSES.map((s) => (
                  <option key={s} value={s} style={{ backgroundColor: colors.panel }}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span style={{ color: colors.muted }}>Channel</span>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as Channel | "")}
                className="rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
                style={{ borderColor: colors.border, color: colors.text, backgroundColor: colors.panel }}
              >
                <option value="" style={{ backgroundColor: colors.panel }}>
                  —
                </option>
                {CHANNELS.map((c) => (
                  <option key={c} value={c} style={{ backgroundColor: colors.panel }}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 text-sm">
              <span style={{ color: colors.muted }}>Applied date</span>
              <input
                type="date"
                value={appliedDate}
                onChange={(e) => setAppliedDate(e.target.value)}
                className="rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
                style={{ borderColor: colors.border, color: colors.text, colorScheme: "dark" }}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span style={{ color: colors.muted }}>Follow-up date</span>
              <input
                type="date"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
                className="rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
                style={{ borderColor: colors.border, color: colors.text, colorScheme: "dark" }}
              />
            </label>
          </div>

          <label className="flex flex-col gap-1.5 text-sm">
            <span style={{ color: colors.muted }}>Rejection reason (optional)</span>
            <input
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. went with an internal candidate"
              className="rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
              style={{ borderColor: colors.border, color: colors.text }}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span style={{ color: colors.muted }}>Notes</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
              style={{ borderColor: colors.border, color: colors.text }}
            />
          </label>

          <div className="flex flex-col gap-1.5 text-sm">
            <span style={{ color: colors.muted }}>Contacts</span>
            {linkedContacts.length > 0 && (
              <ul className="flex flex-col gap-1.5">
                {linkedContacts.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between rounded-lg border px-3 py-1.5 text-sm"
                    style={{ borderColor: colors.border }}
                  >
                    <span style={{ color: colors.text }}>
                      {c.name}
                      {c.role ? ` · ${c.role}` : ""}
                    </span>
                    <button
                      type="button"
                      onClick={() => unlinkContactFromApplication(c.id, application.id)}
                      className="text-xs underline underline-offset-2"
                      style={{ color: colors.muted }}
                    >
                      Unlink
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {unlinkedContacts.length > 0 && (
              <div className="flex gap-2">
                <select
                  value={linkingContactId}
                  onChange={(e) => setLinkingContactId(e.target.value)}
                  className="flex-1 rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
                  style={{ borderColor: colors.border, color: colors.text, backgroundColor: colors.panel }}
                >
                  <option value="" style={{ backgroundColor: colors.panel }}>
                    Link an existing contact…
                  </option>
                  {unlinkedContacts.map((c) => (
                    <option key={c.id} value={c.id} style={{ backgroundColor: colors.panel }}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!linkingContactId}
                  onClick={() => {
                    linkContactToApplication(linkingContactId, application.id)
                    setLinkingContactId("")
                  }}
                  className="rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-50"
                  style={{ borderColor: colors.border, color: colors.text }}
                >
                  Link
                </button>
              </div>
            )}
            {contacts.length === 0 && (
              <p className="text-sm" style={{ color: colors.muted }}>
                No contacts yet — add one from the Contacts view.
              </p>
            )}
          </div>

          {error && (
            <p className="text-sm" style={{ color: colors.amber }}>
              {error}
            </p>
          )}

          <div className="mt-1 flex items-center justify-between gap-3">
            {confirmingDelete ? (
              <div className="flex items-center gap-2 text-sm">
                <span style={{ color: colors.muted }}>Delete this application?</span>
                <button
                  type="button"
                  onClick={remove}
                  disabled={deleting}
                  className="font-medium underline underline-offset-2 disabled:opacity-60"
                  style={{ color: colors.amber }}
                >
                  {deleting ? "Deleting…" : "Confirm"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className="underline underline-offset-2"
                  style={{ color: colors.muted }}
                >
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
                Delete application
              </button>
            )}

            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="rounded-lg px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: colors.teal, color: colors.bg }}
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

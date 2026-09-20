"use client"

import { useState, type FormEvent } from "react"
import { colors } from "@/lib/theme"
import { useAuth } from "@/lib/auth-context"
import { createManualApplication, findPossibleDuplicate } from "@/lib/firestore/applications"
import { APPLICATION_STATUSES, CHANNELS, type ApplicationStatus, type Channel } from "@/lib/types"

export default function AddApplicationModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuth()
  const [company, setCompany] = useState("")
  const [title, setTitle] = useState("")
  const [location, setLocation] = useState("")
  const [postingUrl, setPostingUrl] = useState("")
  const [status, setStatus] = useState<ApplicationStatus>("Found")
  const [channel, setChannel] = useState<Channel | "">("")
  const [notes, setNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null)
  const [confirmedPastDuplicate, setConfirmedPastDuplicate] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!user) return
    setError(null)
    setSubmitting(true)
    try {
      if (!confirmedPastDuplicate) {
        const dup = await findPossibleDuplicate(user.uid, company, title)
        if (dup) {
          setDuplicateWarning(
            `You already have an application to ${dup.company} for "${dup.title}" within the last 90 days. Add this one anyway?`,
          )
          setSubmitting(false)
          return
        }
      }
      await createManualApplication(user.uid, {
        company,
        title,
        location,
        postingUrl: postingUrl || undefined,
        status,
        channel: channel || undefined,
        notes: notes || undefined,
      })
      onClose()
    } catch {
      setError("Couldn't save that application. Please try again.")
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border p-6"
        style={{ borderColor: colors.border, backgroundColor: colors.panel }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold" style={{ color: colors.text }}>
            Add application
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm"
            style={{ color: colors.muted }}
            aria-label="Close"
          >
            Close
          </button>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-3.5">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 text-sm">
              <span style={{ color: colors.muted }}>Company</span>
              <input
                required
                value={company}
                onChange={(e) => {
                  setCompany(e.target.value)
                  setDuplicateWarning(null)
                  setConfirmedPastDuplicate(false)
                }}
                className="rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
                style={{ borderColor: colors.border, color: colors.text }}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span style={{ color: colors.muted }}>Title</span>
              <input
                required
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value)
                  setDuplicateWarning(null)
                  setConfirmedPastDuplicate(false)
                }}
                className="rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
                style={{ borderColor: colors.border, color: colors.text }}
              />
            </label>
          </div>

          <label className="flex flex-col gap-1.5 text-sm">
            <span style={{ color: colors.muted }}>Location</span>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Remote, or a city"
              className="rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
              style={{ borderColor: colors.border, color: colors.text }}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span style={{ color: colors.muted }}>Posting URL (optional)</span>
            <input
              type="url"
              value={postingUrl}
              onChange={(e) => setPostingUrl(e.target.value)}
              className="rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
              style={{ borderColor: colors.border, color: colors.text }}
            />
          </label>

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

          <label className="flex flex-col gap-1.5 text-sm">
            <span style={{ color: colors.muted }}>Notes (optional)</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
              style={{ borderColor: colors.border, color: colors.text }}
            />
          </label>

          {duplicateWarning && (
            <div
              className="rounded-lg border p-3 text-sm"
              style={{ borderColor: colors.amber, color: colors.text, backgroundColor: "rgba(245,166,35,0.08)" }}
            >
              <p>{duplicateWarning}</p>
              <button
                type="button"
                onClick={() => {
                  setConfirmedPastDuplicate(true)
                  setDuplicateWarning(null)
                }}
                className="mt-2 font-medium underline underline-offset-2"
                style={{ color: colors.amber }}
              >
                Add it anyway
              </button>
            </div>
          )}

          {error && (
            <p className="text-sm" style={{ color: colors.amber }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || !!duplicateWarning}
            className="mt-1 rounded-lg px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: colors.teal, color: colors.bg }}
          >
            {submitting ? "Saving…" : "Add application"}
          </button>
        </form>
      </div>
    </div>
  )
}

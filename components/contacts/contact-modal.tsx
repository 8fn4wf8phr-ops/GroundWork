"use client"

import { useState, type FormEvent } from "react"
import { colors } from "@/lib/theme"
import { useAuth } from "@/lib/auth-context"
import { createContact, deleteContact, updateContact } from "@/lib/firestore/contacts"
import type { Contact } from "@/lib/types"

export default function ContactModal({
  contact,
  onClose,
}: {
  contact?: Contact
  onClose: () => void
}) {
  const { user } = useAuth()
  const [name, setName] = useState(contact?.name ?? "")
  const [role, setRole] = useState(contact?.role ?? "")
  const [email, setEmail] = useState(contact?.email ?? "")
  const [phone, setPhone] = useState(contact?.phone ?? "")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    setError(null)
    try {
      const input = { name, role: role || undefined, email: email || undefined, phone: phone || undefined }
      if (contact) {
        await updateContact(contact.id, input)
      } else {
        await createContact(user.uid, input)
      }
      onClose()
    } catch {
      setError("Couldn't save this contact. Please try again.")
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!contact) return
    setDeleting(true)
    try {
      await deleteContact(contact.id)
      onClose()
    } catch {
      setError("Couldn't delete this contact. Please try again.")
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
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold" style={{ color: colors.text }}>
            {contact ? "Edit contact" : "Add contact"}
          </h2>
          <button type="button" onClick={onClose} className="text-sm" style={{ color: colors.muted }} aria-label="Close">
            Close
          </button>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-3.5">
          <label className="flex flex-col gap-1.5 text-sm">
            <span style={{ color: colors.muted }}>Name</span>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
              style={{ borderColor: colors.border, color: colors.text }}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span style={{ color: colors.muted }}>Role (optional)</span>
            <input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. Technical Recruiter"
              className="rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
              style={{ borderColor: colors.border, color: colors.text }}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 text-sm">
              <span style={{ color: colors.muted }}>Email (optional)</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
                style={{ borderColor: colors.border, color: colors.text }}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span style={{ color: colors.muted }}>Phone (optional)</span>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
                style={{ borderColor: colors.border, color: colors.text }}
              />
            </label>
          </div>

          {error && (
            <p className="text-sm" style={{ color: colors.amber }}>
              {error}
            </p>
          )}

          <div className="mt-1 flex items-center justify-between gap-3">
            {contact ? (
              confirmingDelete ? (
                <div className="flex items-center gap-2 text-sm">
                  <span style={{ color: colors.muted }}>Delete this contact?</span>
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
                  Delete contact
                </button>
              )
            ) : (
              <span />
            )}

            <button
              type="submit"
              disabled={saving}
              className="rounded-lg px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: colors.teal, color: colors.bg }}
            >
              {saving ? "Saving…" : contact ? "Save changes" : "Add contact"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

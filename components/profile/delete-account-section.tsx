"use client"

import { useState } from "react"
import { colors } from "@/lib/theme"
import { useAuth } from "@/lib/auth-context"
import { deleteAccount } from "@/lib/firestore/account"

export default function DeleteAccountSection() {
  const { user, signOutUser } = useAuth()
  const [expanded, setExpanded] = useState(false)
  const [confirmText, setConfirmText] = useState("")
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!user) return null

  const canDelete = confirmText.trim().toLowerCase() === (user.email ?? "").toLowerCase()

  const handleDelete = async () => {
    if (!canDelete) return
    setDeleting(true)
    setError(null)
    try {
      await deleteAccount(user)
      // deleteAccount signs the user out as its last step — AuthGate
      // picks that up and shows the sign-in screen automatically.
    } catch (err) {
      // Firebase requires a "recent" sign-in for account deletion — an
      // older session throws this specific code rather than succeeding.
      if (err instanceof Error && "code" in err && err.code === "auth/requires-recent-login") {
        setError("For security, please sign out and sign back in, then try deleting your account again.")
      } else {
        setError("Couldn't delete your account. Please try again.")
      }
      setDeleting(false)
    }
  }

  return (
    <div className="mt-8 rounded-xl border p-6" style={{ borderColor: colors.amber, backgroundColor: "rgba(245,166,35,0.06)" }}>
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colors.amber }} />
        <span className="text-sm font-semibold" style={{ color: colors.amber }}>
          Danger zone
        </span>
      </div>

      {!expanded ? (
        <>
          <p className="mt-2.5 text-sm leading-relaxed" style={{ color: colors.text }}>
            Permanently delete your account and everything in it — Profile, Resume, every Job, Application, and
            Contact. This can&apos;t be undone.
          </p>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="mt-4 rounded-md border px-3.5 py-1.5 text-sm font-medium transition-colors hover:opacity-90"
            style={{ borderColor: colors.amber, color: colors.amber }}
          >
            Delete my account
          </button>
        </>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          <p className="text-sm leading-relaxed" style={{ color: colors.text }}>
            This permanently deletes your account and all data — there&apos;s no undo. Type your email (
            <span className="font-medium">{user.email}</span>) to confirm.
          </p>
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={user.email ?? ""}
            className="rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
            style={{ borderColor: colors.border, color: colors.text }}
          />
          {error && (
            <p className="text-sm" style={{ color: colors.amber }}>
              {error}
            </p>
          )}
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={!canDelete || deleting}
              onClick={handleDelete}
              className="rounded-md px-3.5 py-1.5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: colors.amber, color: colors.bg }}
            >
              {deleting ? "Deleting…" : "Permanently delete my account"}
            </button>
            <button
              type="button"
              onClick={() => {
                setExpanded(false)
                setConfirmText("")
                setError(null)
              }}
              className="text-sm underline underline-offset-2"
              style={{ color: colors.muted }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

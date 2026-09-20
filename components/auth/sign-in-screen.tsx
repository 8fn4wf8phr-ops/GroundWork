"use client"

import { useState, type FormEvent } from "react"
import { colors } from "@/lib/theme"
import { useAuth } from "@/lib/auth-context"

export default function SignInScreen() {
  const { signInWithEmail, signUpWithEmail, signInWithGoogle, error, clearError } = useAuth()
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      if (mode === "signIn") {
        await signInWithEmail(email, password)
      } else {
        await signUpWithEmail(email, password)
      }
    } catch {
      // error is already surfaced via context state
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4 font-sans"
      style={{ backgroundColor: colors.bg, color: colors.text, fontFamily: "var(--font-inter)" }}
    >
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center gap-2">
          <h1 className="text-xl font-bold" style={{ color: colors.text, fontFamily: "var(--font-space-grotesk)" }}>
            Groundwork
          </h1>
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: colors.teal }} />
        </div>

        <div className="rounded-xl border p-6" style={{ borderColor: colors.border, backgroundColor: colors.panel }}>
          <h2 className="text-lg font-semibold" style={{ color: colors.text }}>
            {mode === "signIn" ? "Sign in" : "Create your account"}
          </h2>
          <p className="mt-1 text-sm" style={{ color: colors.muted }}>
            {mode === "signIn"
              ? "Your applications, resume, and contacts are private to your account."
              : "Groundwork keeps your resume and applications behind your own sign-in."}
          </p>

          <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3.5">
            <label className="flex flex-col gap-1.5 text-sm">
              <span style={{ color: colors.muted }}>Email</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
                style={{ borderColor: colors.border, color: colors.text }}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span style={{ color: colors.muted }}>Password</span>
              <input
                type="password"
                required
                minLength={6}
                autoComplete={mode === "signIn" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
                style={{ borderColor: colors.border, color: colors.text }}
              />
            </label>

            {error && (
              <p className="text-sm" style={{ color: colors.amber }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-1 rounded-lg px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: colors.teal, color: colors.bg }}
            >
              {submitting ? "Please wait…" : mode === "signIn" ? "Sign in" : "Create account"}
            </button>
          </form>

          <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1" style={{ backgroundColor: colors.border }} />
            <span className="text-xs" style={{ color: colors.muted }}>
              or
            </span>
            <div className="h-px flex-1" style={{ backgroundColor: colors.border }} />
          </div>

          <button
            type="button"
            onClick={() => signInWithGoogle()}
            className="flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:opacity-90"
            style={{ borderColor: colors.border, color: colors.text }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.54-5.17 3.54-8.66Z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.07 7.93-2.9l-3.87-3.01c-1.08.72-2.46 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.94H1.28v3.1A12 12 0 0 0 12 24Z"
              />
              <path
                fill="#FBBC05"
                d="M5.29 14.3a7.2 7.2 0 0 1 0-4.6v-3.1H1.28a12 12 0 0 0 0 10.8l4.01-3.1Z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.76 0 3.35.6 4.6 1.79l3.44-3.44C17.94 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.28 6.6l4.01 3.1C6.23 6.86 8.88 4.75 12 4.75Z"
              />
            </svg>
            Continue with Google
          </button>

          <p className="mt-5 text-center text-sm" style={{ color: colors.muted }}>
            {mode === "signIn" ? "New to Groundwork?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => {
                clearError()
                setMode(mode === "signIn" ? "signUp" : "signIn")
              }}
              className="font-medium underline underline-offset-2"
              style={{ color: colors.teal }}
            >
              {mode === "signIn" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}

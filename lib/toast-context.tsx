"use client"

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react"
import { colors } from "@/lib/theme"

// A minimal, dependency-free toast layer — this project has no UI kit to
// pull a toast component from, and the need here is narrow: surface a
// real, specific error message (e.g. "Couldn't reach Compass — check your
// connection and try again") instead of letting a raw network error like
// "Failed to fetch" leak to the user, or instead of an error silently
// going nowhere. Not a replacement for inline validation errors (a form
// field's "required" message stays next to the field) — this is for
// transient, action-triggered failures.
export type ToastVariant = "error" | "info"
type Toast = { id: number; message: string; variant: ToastVariant }

type ToastContextValue = {
  showToast: (message: string, variant?: ToastVariant) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const AUTO_DISMISS_MS = 6000

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback(
    (message: string, variant: ToastVariant = "error") => {
      const id = nextId.current++
      setToasts((prev) => [...prev, { id, message, variant }])
      setTimeout(() => dismiss(id), AUTO_DISMISS_MS)
    },
    [dismiss],
  )

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 sm:bottom-6"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="alert"
            className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg"
            style={{
              backgroundColor: colors.panel,
              borderColor: t.variant === "error" ? colors.amber : colors.border,
              color: colors.text,
            }}
          >
            <span className="flex-1">{t.message}</span>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="shrink-0 text-xs underline underline-offset-2"
              style={{ color: colors.muted }}
            >
              Dismiss
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error("useToast must be used within ToastProvider")
  return ctx
}

// Convenience for the common case: catch an error, extract a message, show
// it. `fallback` covers the (rare, now mostly eliminated by
// lib/fetch-friendly.ts) case of a non-Error throw.
export function useErrorToast() {
  const { showToast } = useToast()
  return useCallback(
    (err: unknown, fallback: string) => {
      showToast(err instanceof Error ? err.message : fallback, "error")
    },
    [showToast],
  )
}

"use client"

import { useState, type KeyboardEvent } from "react"
import { colors } from "@/lib/theme"

export default function TagListInput({
  label,
  placeholder,
  values,
  onChange,
}: {
  label: string
  placeholder?: string
  values: string[]
  onChange: (values: string[]) => void
}) {
  const [draft, setDraft] = useState("")

  const commit = () => {
    // Splitting here (not just on comma keydown) also covers paste: pasting
    // a whole comma-separated block fills `draft` in one go with no
    // per-character keydown events, so committing it verbatim would add
    // one giant tag instead of several short ones (this is exactly how
    // Resume's skills field ended up with a single 294-char entry that a
    // downstream Zod schema rejects — see JOURNEY.md).
    const seen = new Set(values)
    const parts: string[] = []
    for (const raw of draft.split(",")) {
      const p = raw.trim()
      if (p && !seen.has(p)) {
        seen.add(p)
        parts.push(p)
      }
    }
    if (parts.length > 0) {
      onChange([...values, ...parts])
    }
    setDraft("")
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      commit()
    } else if (e.key === "Backspace" && draft === "" && values.length > 0) {
      onChange(values.slice(0, -1))
    }
  }

  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <span style={{ color: colors.muted }}>{label}</span>
      <div
        className="flex flex-wrap items-center gap-1.5 rounded-lg border px-2 py-1.5"
        style={{ borderColor: colors.border }}
      >
        {values.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium"
            style={{ color: colors.teal, backgroundColor: "rgba(53,201,193,0.12)" }}
          >
            {v}
            <button
              type="button"
              onClick={() => onChange(values.filter((x) => x !== v))}
              aria-label={`Remove ${v}`}
              className="opacity-70 hover:opacity-100"
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commit}
          placeholder={values.length === 0 ? placeholder : ""}
          className="min-w-[8ch] flex-1 bg-transparent px-1 py-0.5 text-sm outline-none"
          style={{ color: colors.text }}
        />
      </div>
    </div>
  )
}

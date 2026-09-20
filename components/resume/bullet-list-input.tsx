"use client"

import { useState, type KeyboardEvent } from "react"
import { colors } from "@/lib/theme"

// Bullets are full sentences, so they render as a vertical list rather
// than TagListInput's pill layout — pills work for short tags, not
// wrapped prose.
export default function BulletListInput({
  values,
  onChange,
}: {
  values: string[]
  onChange: (values: string[]) => void
}) {
  const [draft, setDraft] = useState("")

  const commit = () => {
    const value = draft.trim()
    if (value) onChange([...values, value])
    setDraft("")
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      commit()
    }
  }

  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <span style={{ color: colors.muted }}>Bullet points</span>
      {values.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {values.map((bullet, i) => (
            <li key={i} className="flex items-start gap-2 text-sm" style={{ color: colors.text }}>
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full" style={{ backgroundColor: colors.muted }} />
              <span className="flex-1">{bullet}</span>
              <button
                type="button"
                onClick={() => onChange(values.filter((_, idx) => idx !== i))}
                className="shrink-0 text-xs underline underline-offset-2"
                style={{ color: colors.muted }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a bullet point — press Enter"
          className="flex-1 rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
          style={{ borderColor: colors.border, color: colors.text }}
        />
        <button
          type="button"
          onClick={commit}
          className="rounded-lg border px-3 py-2 text-sm font-medium"
          style={{ borderColor: colors.border, color: colors.text }}
        >
          Add
        </button>
      </div>
    </div>
  )
}

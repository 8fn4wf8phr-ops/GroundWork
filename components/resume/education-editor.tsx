"use client"

import { colors } from "@/lib/theme"
import EntryCard from "@/components/resume/entry-card"
import type { EducationEntry } from "@/lib/types"

export default function EducationEditor({
  entries,
  onChange,
}: {
  entries: EducationEntry[]
  onChange: (entries: EducationEntry[]) => void
}) {
  const update = (id: string, patch: Partial<EducationEntry>) => {
    onChange(entries.map((e) => (e.id === id ? { ...e, ...patch } : e)))
  }

  const add = () => {
    onChange([...entries, { id: crypto.randomUUID(), school: "", degree: "", field: "", startDate: "", endDate: "" }])
  }

  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs font-medium uppercase tracking-wide" style={{ color: colors.muted }}>
        Education
      </span>
      {entries.map((entry) => (
        <EntryCard key={entry.id} onRemove={() => onChange(entries.filter((e) => e.id !== entry.id))}>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 text-sm">
              <span style={{ color: colors.muted }}>School</span>
              <input
                value={entry.school}
                onChange={(e) => update(entry.id, { school: e.target.value })}
                className="rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
                style={{ borderColor: colors.border, color: colors.text }}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span style={{ color: colors.muted }}>Degree</span>
              <input
                value={entry.degree}
                onChange={(e) => update(entry.id, { degree: e.target.value })}
                placeholder="e.g. B.S."
                className="rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
                style={{ borderColor: colors.border, color: colors.text }}
              />
            </label>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <label className="col-span-1 flex flex-col gap-1.5 text-sm">
              <span style={{ color: colors.muted }}>Field of study</span>
              <input
                value={entry.field ?? ""}
                onChange={(e) => update(entry.id, { field: e.target.value })}
                className="rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
                style={{ borderColor: colors.border, color: colors.text }}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span style={{ color: colors.muted }}>Start</span>
              <input
                type="month"
                value={entry.startDate ?? ""}
                onChange={(e) => update(entry.id, { startDate: e.target.value })}
                className="rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
                style={{ borderColor: colors.border, color: colors.text, colorScheme: "dark" }}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span style={{ color: colors.muted }}>End</span>
              <input
                type="month"
                value={entry.endDate ?? ""}
                onChange={(e) => update(entry.id, { endDate: e.target.value })}
                className="rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
                style={{ borderColor: colors.border, color: colors.text, colorScheme: "dark" }}
              />
            </label>
          </div>
        </EntryCard>
      ))}
      <button
        type="button"
        onClick={add}
        className="self-start rounded-md border px-3 py-1.5 text-sm font-medium transition-colors hover:opacity-90"
        style={{ borderColor: colors.border, color: colors.text }}
      >
        + Add education
      </button>
    </div>
  )
}

"use client"

import { colors } from "@/lib/theme"
import EntryCard from "@/components/resume/entry-card"
import BulletListInput from "@/components/resume/bullet-list-input"
import type { ExperienceEntry } from "@/lib/types"

export default function ExperienceEditor({
  entries,
  onChange,
}: {
  entries: ExperienceEntry[]
  onChange: (entries: ExperienceEntry[]) => void
}) {
  const update = (id: string, patch: Partial<ExperienceEntry>) => {
    onChange(entries.map((e) => (e.id === id ? { ...e, ...patch } : e)))
  }

  const add = () => {
    onChange([
      ...entries,
      { id: crypto.randomUUID(), company: "", title: "", startDate: "", endDate: "", current: false, bullets: [] },
    ])
  }

  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs font-medium uppercase tracking-wide" style={{ color: colors.muted }}>
        Experience
      </span>
      {entries.map((entry) => (
        <EntryCard key={entry.id} onRemove={() => onChange(entries.filter((e) => e.id !== entry.id))}>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 text-sm">
              <span style={{ color: colors.muted }}>Company</span>
              <input
                value={entry.company}
                onChange={(e) => update(entry.id, { company: e.target.value })}
                className="rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
                style={{ borderColor: colors.border, color: colors.text }}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span style={{ color: colors.muted }}>Title</span>
              <input
                value={entry.title}
                onChange={(e) => update(entry.id, { title: e.target.value })}
                className="rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
                style={{ borderColor: colors.border, color: colors.text }}
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 text-sm">
              <span style={{ color: colors.muted }}>Start date</span>
              <input
                type="month"
                value={entry.startDate}
                onChange={(e) => update(entry.id, { startDate: e.target.value })}
                className="rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
                style={{ borderColor: colors.border, color: colors.text, colorScheme: "dark" }}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span style={{ color: colors.muted }}>End date</span>
              <input
                type="month"
                value={entry.endDate ?? ""}
                disabled={entry.current}
                onChange={(e) => update(entry.id, { endDate: e.target.value })}
                className="rounded-lg border bg-transparent px-3 py-2 text-sm outline-none disabled:opacity-50"
                style={{ borderColor: colors.border, color: colors.text, colorScheme: "dark" }}
              />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm" style={{ color: colors.muted }}>
            <input
              type="checkbox"
              checked={entry.current}
              onChange={(e) => update(entry.id, { current: e.target.checked, endDate: e.target.checked ? "" : entry.endDate })}
            />
            I currently work here
          </label>
          <BulletListInput values={entry.bullets} onChange={(bullets) => update(entry.id, { bullets })} />
        </EntryCard>
      ))}
      <button
        type="button"
        onClick={add}
        className="self-start rounded-md border px-3 py-1.5 text-sm font-medium transition-colors hover:opacity-90"
        style={{ borderColor: colors.border, color: colors.text }}
      >
        + Add experience
      </button>
    </div>
  )
}

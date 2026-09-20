"use client"

import { colors } from "@/lib/theme"
import EntryCard from "@/components/resume/entry-card"
import type { CertificationEntry } from "@/lib/types"

export default function CertificationEditor({
  entries,
  onChange,
}: {
  entries: CertificationEntry[]
  onChange: (entries: CertificationEntry[]) => void
}) {
  const update = (id: string, patch: Partial<CertificationEntry>) => {
    onChange(entries.map((e) => (e.id === id ? { ...e, ...patch } : e)))
  }

  const add = () => {
    onChange([...entries, { id: crypto.randomUUID(), name: "", issuer: "", date: "" }])
  }

  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs font-medium uppercase tracking-wide" style={{ color: colors.muted }}>
        Certifications
      </span>
      {entries.map((entry) => (
        <EntryCard key={entry.id} onRemove={() => onChange(entries.filter((e) => e.id !== entry.id))}>
          <div className="grid grid-cols-3 gap-3">
            <label className="col-span-1 flex flex-col gap-1.5 text-sm">
              <span style={{ color: colors.muted }}>Name</span>
              <input
                value={entry.name}
                onChange={(e) => update(entry.id, { name: e.target.value })}
                className="rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
                style={{ borderColor: colors.border, color: colors.text }}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span style={{ color: colors.muted }}>Issuer</span>
              <input
                value={entry.issuer ?? ""}
                onChange={(e) => update(entry.id, { issuer: e.target.value })}
                className="rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
                style={{ borderColor: colors.border, color: colors.text }}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span style={{ color: colors.muted }}>Date</span>
              <input
                type="month"
                value={entry.date ?? ""}
                onChange={(e) => update(entry.id, { date: e.target.value })}
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
        + Add certification
      </button>
    </div>
  )
}

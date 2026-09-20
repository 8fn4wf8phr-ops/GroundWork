"use client"

import { colors } from "@/lib/theme"
import EntryCard from "@/components/resume/entry-card"
import TagListInput from "@/components/profile/tag-list-input"
import type { ProjectEntry } from "@/lib/types"

export default function ProjectEditor({
  entries,
  onChange,
}: {
  entries: ProjectEntry[]
  onChange: (entries: ProjectEntry[]) => void
}) {
  const update = (id: string, patch: Partial<ProjectEntry>) => {
    onChange(entries.map((e) => (e.id === id ? { ...e, ...patch } : e)))
  }

  const add = () => {
    onChange([...entries, { id: crypto.randomUUID(), name: "", description: "", skills: [], link: "" }])
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <span className="text-xs font-medium uppercase tracking-wide" style={{ color: colors.muted }}>
          Projects
        </span>
        <p className="mt-1 text-xs" style={{ color: colors.muted }}>
          What Quill selects from when tailoring — the 1–2 most relevant projects per posting (spec §16).
        </p>
      </div>
      {entries.map((entry) => (
        <EntryCard key={entry.id} onRemove={() => onChange(entries.filter((e) => e.id !== entry.id))}>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 text-sm">
              <span style={{ color: colors.muted }}>Name</span>
              <input
                value={entry.name}
                onChange={(e) => update(entry.id, { name: e.target.value })}
                className="rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
                style={{ borderColor: colors.border, color: colors.text }}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span style={{ color: colors.muted }}>Link (optional)</span>
              <input
                type="url"
                value={entry.link ?? ""}
                onChange={(e) => update(entry.id, { link: e.target.value })}
                className="rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
                style={{ borderColor: colors.border, color: colors.text }}
              />
            </label>
          </div>
          <label className="flex flex-col gap-1.5 text-sm">
            <span style={{ color: colors.muted }}>Description</span>
            <textarea
              value={entry.description}
              onChange={(e) => update(entry.id, { description: e.target.value })}
              rows={2}
              className="rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
              style={{ borderColor: colors.border, color: colors.text }}
            />
          </label>
          <TagListInput
            label="Skills / technologies demonstrated"
            placeholder="e.g. React, Firebase — press Enter to add"
            values={entry.skills}
            onChange={(skills) => update(entry.id, { skills })}
          />
        </EntryCard>
      ))}
      <button
        type="button"
        onClick={add}
        className="self-start rounded-md border px-3 py-1.5 text-sm font-medium transition-colors hover:opacity-90"
        style={{ borderColor: colors.border, color: colors.text }}
      >
        + Add project
      </button>
    </div>
  )
}

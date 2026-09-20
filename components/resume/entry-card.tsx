import type { ReactNode } from "react"
import { colors } from "@/lib/theme"

export default function EntryCard({ children, onRemove }: { children: ReactNode; onRemove: () => void }) {
  return (
    <div className="relative rounded-lg border p-4" style={{ borderColor: colors.border, backgroundColor: colors.card }}>
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-3 top-3 text-xs underline underline-offset-2"
        style={{ color: colors.muted }}
      >
        Remove
      </button>
      <div className="flex flex-col gap-3 pr-16">{children}</div>
    </div>
  )
}

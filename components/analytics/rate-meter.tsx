import { colors } from "@/lib/theme"

// Meter form (dataviz skill): fill carries the value, unfilled track is a
// lighter step of the same ramp — teal-on-teal, not a second hue — so a
// row of meters reads as one consistent scale rather than three unrelated
// colors. Value labeled at the tip, per the skill's bar-label rule.
export default function RateMeter({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 shrink-0 text-xs" style={{ color: colors.muted }}>
        {label}
      </span>
      <div className="h-2 flex-1 overflow-hidden rounded-full" style={{ backgroundColor: "rgba(53,201,193,0.15)" }}>
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.max(0, Math.min(100, value))}%`, backgroundColor: colors.teal }}
        />
      </div>
      <span className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums" style={{ color: colors.text }}>
        {value}%
      </span>
    </div>
  )
}

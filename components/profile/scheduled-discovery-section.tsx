"use client"

import { useState } from "react"
import { colors } from "@/lib/theme"
import { useAuth } from "@/lib/auth-context"
import { useProfile } from "@/lib/hooks/use-profile"
import { saveScheduledDiscovery } from "@/lib/firestore/profile"
import { SCHEDULED_SOURCES, type ScheduledSourceId } from "@/lib/types"

// Opt-in daily discovery (see lib/server/scheduled-discovery.ts). Saves on
// every change — there's no separate Save button, since it isn't part of
// the Profile form and the cron reads it straight from Firestore.
export default function ScheduledDiscoverySection() {
  const { user } = useAuth()
  const { profile } = useProfile()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const settings = profile?.scheduledDiscovery
  const enabled = settings?.enabled ?? false
  const sources = settings?.sources ?? SCHEDULED_SOURCES.map((s) => s.id)
  // Without a saved Profile there's nothing to match against (and toggling
  // would create a stub document); without target roles every score is
  // meaningless and Compass has nothing to say.
  const blockedReason = !profile
    ? "Save your profile first."
    : profile.targetRoles.length === 0
      ? "Add at least one target role and save your profile first."
      : null

  const update = async (next: { enabled: boolean; sources: ScheduledSourceId[] }) => {
    if (!user) return
    setSaving(true)
    setError(null)
    try {
      await saveScheduledDiscovery(user.uid, next)
    } catch {
      setError("Couldn't save that setting. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const toggleSource = (id: ScheduledSourceId) => {
    const next = sources.includes(id) ? sources.filter((s) => s !== id) : [...sources, id]
    void update({ enabled, sources: next })
  }

  return (
    <div
      className="mt-6 flex flex-col gap-3 rounded-xl border p-6"
      style={{ borderColor: colors.border, backgroundColor: colors.panel }}
    >
      <div>
        <h3 className="text-base font-semibold" style={{ color: colors.text }}>
          Daily discovery
        </h3>
        <p className="mt-1 text-sm" style={{ color: colors.muted }}>
          Once a day, Groundwork pulls new postings for you and keeps only the ones that match your profile (score
          30+, up to 25 a day). Compass and Scout comment on the top three in your Case File. Nothing is applied to
          for you.
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm" style={{ color: colors.text }}>
        <input
          type="checkbox"
          checked={enabled}
          disabled={saving || blockedReason !== null}
          onChange={(e) => void update({ enabled: e.target.checked, sources })}
        />
        Pull new matches for me every day
      </label>

      <fieldset className="flex flex-wrap gap-4" disabled={saving || blockedReason !== null}>
        <legend className="sr-only">Sources</legend>
        {SCHEDULED_SOURCES.map((s) => (
          <label key={s.id} className="flex items-center gap-2 text-sm" style={{ color: colors.text }}>
            <input type="checkbox" checked={sources.includes(s.id)} onChange={() => toggleSource(s.id)} />
            {s.label}
          </label>
        ))}
      </fieldset>

      {blockedReason && (
        <p className="text-sm" style={{ color: colors.amber }}>
          {blockedReason}
        </p>
      )}
      {enabled && sources.length === 0 && (
        <p className="text-sm" style={{ color: colors.amber }}>
          Pick at least one source, or nothing will be pulled.
        </p>
      )}
      {error && (
        <p className="text-sm" style={{ color: colors.amber }}>
          {error}
        </p>
      )}
      {settings?.lastRunSummary && (
        <p className="text-sm" style={{ color: colors.muted }}>
          Last run{settings.lastRunAt ? ` ${new Date(settings.lastRunAt).toLocaleString()}` : ""}:{" "}
          {settings.lastRunSummary}
        </p>
      )}
    </div>
  )
}

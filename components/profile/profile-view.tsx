"use client"

import { useEffect, useState } from "react"
import { colors } from "@/lib/theme"
import { useAuth } from "@/lib/auth-context"
import { useProfile } from "@/lib/hooks/use-profile"
import { useResume } from "@/lib/hooks/use-resume"
import { saveProfile } from "@/lib/firestore/profile"
import { createCaseFileEntries } from "@/lib/firestore/case-file"
import { detectSageSignal } from "@/lib/agents/sage-signals"
import { checkInWithSage } from "@/lib/agents/sage"
import TagListInput from "@/components/profile/tag-list-input"
import DeleteAccountSection from "@/components/profile/delete-account-section"

export default function ProfileView() {
  const { user } = useAuth()
  const { profile, loading } = useProfile()
  const { resume } = useResume()
  const [checkingIn, setCheckingIn] = useState(false)
  const [sageMessage, setSageMessage] = useState<string | null>(null)

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [targetRoles, setTargetRoles] = useState<string[]>([])
  const [locations, setLocations] = useState<string[]>([])
  const [salaryFloor, setSalaryFloor] = useState("")
  const [mustHaves, setMustHaves] = useState<string[]>([])
  const [dealBreakers, setDealBreakers] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  // Seed the form from the loaded profile (or sensible defaults for a
  // first-time user) exactly once per load — after that, the form owns
  // its own state so typing doesn't get clobbered by the live listener.
  const [seeded, setSeeded] = useState(false)
  useEffect(() => {
    if (loading || seeded) return
    if (profile) {
      setName(profile.name)
      setEmail(profile.email)
      setPhone(profile.phone ?? "")
      setTargetRoles(profile.targetRoles)
      setLocations(profile.locations)
      setSalaryFloor(profile.salaryFloor != null ? String(profile.salaryFloor) : "")
      setMustHaves(profile.mustHaves)
      setDealBreakers(profile.dealBreakers)
    } else if (user?.email) {
      setEmail(user.email)
    }
    setSeeded(true)
  }, [loading, seeded, profile, user])

  const save = async () => {
    if (!user) return
    setSaving(true)
    setError(null)
    try {
      await saveProfile(user.uid, {
        name,
        email,
        phone: phone || undefined,
        targetRoles,
        locations,
        salaryFloor: salaryFloor ? Number(salaryFloor) : undefined,
        mustHaves,
        dealBreakers,
      })
      setSavedAt(Date.now())
    } catch {
      setError("Couldn't save your profile. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const checkInSage = async () => {
    if (!user || !profile) return
    setCheckingIn(true)
    setSageMessage(null)
    try {
      const signal = detectSageSignal(profile, resume)
      if (!signal) {
        setSageMessage("Sage: nothing stands out right now — Profile and Resume line up fine.")
        return
      }
      const message = await checkInWithSage(signal)
      await createCaseFileEntries(user.uid, [{ agent: "Sage", message }])
      setSageMessage("Posted to the Case File — check the Applications board.")
    } catch (err) {
      setSageMessage(err instanceof Error ? `Couldn't reach Sage: ${err.message}` : "Couldn't reach Sage right now.")
    } finally {
      setCheckingIn(false)
    }
  }

  if (loading || !seeded) {
    return (
      <div className="p-6 text-sm" style={{ color: colors.muted }}>
        Loading…
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-2xl p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold" style={{ color: colors.text, fontFamily: "var(--font-space-grotesk)" }}>
          Profile
        </h2>
        <p className="mt-1 text-sm" style={{ color: colors.muted }}>
          What Groundwork matches postings against, and what Quill tailors your resume around. Sage checks in on
          this periodically as your search evolves — nothing here is set in stone.
        </p>
      </div>

      <div
        className="flex flex-col gap-5 rounded-xl border p-6"
        style={{ borderColor: colors.border, backgroundColor: colors.panel }}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm">
            <span style={{ color: colors.muted }}>Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
              style={{ borderColor: colors.border, color: colors.text }}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span style={{ color: colors.muted }}>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
              style={{ borderColor: colors.border, color: colors.text }}
            />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm">
            <span style={{ color: colors.muted }}>Phone (optional)</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
              style={{ borderColor: colors.border, color: colors.text }}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span style={{ color: colors.muted }}>Salary floor (optional)</span>
            <input
              type="number"
              inputMode="numeric"
              value={salaryFloor}
              onChange={(e) => setSalaryFloor(e.target.value)}
              placeholder="e.g. 120000"
              className="rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
              style={{ borderColor: colors.border, color: colors.text }}
            />
          </label>
        </div>

        <TagListInput
          label="Target roles / titles"
          placeholder="e.g. Senior Frontend Engineer — press Enter to add"
          values={targetRoles}
          onChange={setTargetRoles}
        />
        <TagListInput
          label={'Locations (include "Remote" if relevant)'}
          placeholder="e.g. Remote, San Francisco CA"
          values={locations}
          onChange={setLocations}
        />
        <TagListInput
          label="Must-haves"
          placeholder="e.g. Remote-friendly, health insurance"
          values={mustHaves}
          onChange={setMustHaves}
        />
        <TagListInput
          label="Deal-breakers"
          placeholder="e.g. Return-to-office mandate, unpaid overtime culture"
          values={dealBreakers}
          onChange={setDealBreakers}
        />

        {error && (
          <p className="text-sm" style={{ color: colors.amber }}>
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-lg px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: colors.teal, color: colors.bg }}
          >
            {saving ? "Saving…" : "Save profile"}
          </button>
          <button
            type="button"
            onClick={checkInSage}
            disabled={checkingIn}
            className="rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:opacity-90 disabled:opacity-50"
            style={{ borderColor: colors.border, color: colors.text }}
          >
            {checkingIn ? "Checking in…" : "Check in with Sage"}
          </button>
          {savedAt && !saving && (
            <span className="text-sm" style={{ color: colors.muted }}>
              Saved
            </span>
          )}
        </div>
        {sageMessage && (
          <p className="text-sm" style={{ color: colors.muted }}>
            {sageMessage}
          </p>
        )}
      </div>

      <DeleteAccountSection />
    </div>
  )
}

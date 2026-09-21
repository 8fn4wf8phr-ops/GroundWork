"use client"

import { useState } from "react"
import { colors } from "@/lib/theme"
import { useAuth } from "@/lib/auth-context"
import { useProfile } from "@/lib/hooks/use-profile"
import { useReviewQueue } from "@/lib/hooks/use-review-queue"
import { fetchArbeitnowJobs } from "@/lib/discovery/arbeitnow"
import { fetchAdzunaJobsForProfile } from "@/lib/discovery/adzuna"
import { fetchRemoteOkJobs } from "@/lib/discovery/remoteok"
import { fetchJobicyJobsForProfile } from "@/lib/discovery/jobicy"
import { fetchThemuseJobs } from "@/lib/discovery/themuse"
import { saveDiscoveredJobs, dismissJob } from "@/lib/firestore/jobs"
import { createApplicationFromJob } from "@/lib/firestore/applications"
import { createCaseFileEntries } from "@/lib/firestore/case-file"
import { reviewTopNewJobs } from "@/lib/agents/review-jobs"
import type { DiscoveredJob } from "@/lib/discovery/types"
import type { Job, Profile } from "@/lib/types"

type SourceId = "arbeitnow" | "adzuna" | "remoteok" | "jobicy" | "themuse"

const SOURCES: { id: SourceId; label: string; fetch: (profile: Profile) => Promise<DiscoveredJob[]> }[] = [
  { id: "arbeitnow", label: "Arbeitnow", fetch: () => fetchArbeitnowJobs() },
  { id: "adzuna", label: "Adzuna", fetch: (profile) => fetchAdzunaJobsForProfile(profile) },
  { id: "remoteok", label: "RemoteOK", fetch: () => fetchRemoteOkJobs() },
  { id: "themuse", label: "The Muse", fetch: (profile) => fetchThemuseJobs(profile) },
  { id: "jobicy", label: "Jobicy", fetch: (profile) => fetchJobicyJobsForProfile(profile) },
]

function MatchScoreBadge({ score }: { score?: number }) {
  if (score == null) return null
  const tone = score >= 60 ? colors.teal : score >= 30 ? colors.amber : colors.muted
  return (
    <span
      className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold"
      style={{ color: tone, backgroundColor: `${tone}20` }}
    >
      {score}% match
    </span>
  )
}

function QueueCard({
  job,
  onPursue,
  onDismiss,
  busy,
}: {
  job: Job
  onPursue: () => void
  onDismiss: () => void
  busy: boolean
}) {
  return (
    <div className="rounded-lg border p-4" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold" style={{ color: colors.text }}>
            {job.title}
          </h3>
          <p className="mt-0.5 text-sm" style={{ color: colors.muted }}>
            {job.company} · {job.location}
            {job.remote ? " · Remote" : ""}
          </p>
        </div>
        <MatchScoreBadge score={job.matchScore} />
      </div>

      {job.matchReasons && job.matchReasons.length > 0 && (
        <ul className="mt-2.5 flex flex-col gap-1">
          {job.matchReasons.map((reason) => (
            <li
              key={reason}
              className="text-xs"
              style={{ color: reason.startsWith("Possible red flag") ? colors.amber : colors.muted }}
            >
              {reason.startsWith("Possible red flag") ? "⚠ " : "· "}
              {reason}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex items-center gap-2.5">
        <button
          type="button"
          disabled={busy}
          onClick={onPursue}
          className="rounded-md px-3 py-1.5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: colors.teal, color: colors.bg }}
        >
          Pursue
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onDismiss}
          className="rounded-md border px-3 py-1.5 text-sm font-medium transition-colors hover:opacity-90 disabled:opacity-50"
          style={{ borderColor: colors.border, color: colors.text }}
        >
          Dismiss
        </button>
        {job.postingUrl && (
          <a
            href={job.postingUrl}
            target="_blank"
            rel="noreferrer"
            className="ml-auto text-xs underline underline-offset-2"
            style={{ color: colors.muted }}
          >
            View posting
          </a>
        )}
      </div>
    </div>
  )
}

export default function ReviewQueueView() {
  const { user } = useAuth()
  const { profile } = useProfile()
  const { pending, loading } = useReviewQueue()
  const [selectedSource, setSelectedSource] = useState<SourceId>("arbeitnow")
  const [pulling, setPulling] = useState(false)
  const [pullMessage, setPullMessage] = useState<string | null>(null)
  const [busyJobId, setBusyJobId] = useState<string | null>(null)

  const pull = async () => {
    if (!user) return
    const source = SOURCES.find((s) => s.id === selectedSource)!
    setPulling(true)
    setPullMessage(null)
    try {
      const postings = await source.fetch(profile ?? EMPTY_PROFILE)
      const { savedJobs, savedDiscovered, existingJobs } = await saveDiscoveredJobs(
        user.uid,
        postings,
        profile ?? EMPTY_PROFILE,
      )
      setPullMessage(
        savedJobs.length === 0
          ? `Pulled ${postings.length} postings from ${source.label} — no new ones since last time.`
          : `Added ${savedJobs.length} new posting${savedJobs.length === 1 ? "" : "s"} from ${source.label}.`,
      )
      if (savedJobs.length > 0 && profile) {
        try {
          const entries = await reviewTopNewJobs(savedJobs, savedDiscovered, existingJobs, profile)
          if (entries.length > 0) await createCaseFileEntries(user.uid, entries)
        } catch {
          // Agent commentary is a bonus layer on top of real, already-saved
          // Jobs — a failure here shouldn't block the pull itself or hide
          // that the postings landed successfully.
        }
      }
    } catch (err) {
      setPullMessage(
        err instanceof Error
          ? `Couldn't pull from ${source.label}: ${err.message}`
          : `Couldn't reach ${source.label} right now.`,
      )
    } finally {
      setPulling(false)
    }
  }

  const pursue = async (jobId: string) => {
    if (!user) return
    setBusyJobId(jobId)
    try {
      await createApplicationFromJob(user.uid, jobId)
    } finally {
      setBusyJobId(null)
    }
  }

  const dismiss = async (jobId: string) => {
    setBusyJobId(jobId)
    try {
      await dismissJob(jobId)
    } finally {
      setBusyJobId(null)
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl p-6">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold" style={{ color: colors.text, fontFamily: "var(--font-space-grotesk)" }}>
            Review queue
          </h2>
          <p className="mt-1 text-sm" style={{ color: colors.muted }}>
            Newly discovered postings awaiting your call — pursue or dismiss each one.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedSource}
            onChange={(e) => setSelectedSource(e.target.value as SourceId)}
            disabled={pulling}
            className="rounded-md border bg-transparent px-3 py-1.5 text-sm outline-none disabled:opacity-50"
            style={{ borderColor: colors.border, color: colors.text, backgroundColor: colors.bg }}
          >
            {SOURCES.map((s) => (
              <option key={s.id} value={s.id} style={{ backgroundColor: colors.bg }}>
                {s.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={pulling}
            onClick={pull}
            className="rounded-md border px-3 py-1.5 text-sm font-medium transition-colors hover:opacity-90 disabled:opacity-50"
            style={{ borderColor: colors.border, color: colors.text }}
          >
            {pulling ? "Pulling…" : "Pull new postings"}
          </button>
        </div>
      </div>

      {pullMessage && (
        <p className="mb-4 text-sm" style={{ color: colors.muted }}>
          {pullMessage}
        </p>
      )}

      {profile && profile.targetRoles.length === 0 && (
        <p className="mb-4 text-sm" style={{ color: colors.amber }}>
          Add target roles in your Profile to get real match scores — everything will score low without them.
        </p>
      )}

      {loading ? (
        <p className="text-sm" style={{ color: colors.muted }}>
          Loading…
        </p>
      ) : pending.length === 0 ? (
        <div
          className="rounded-lg border border-dashed p-8 text-center text-sm"
          style={{ borderColor: colors.border, color: colors.muted }}
        >
          Nothing waiting on you — pull new postings to fill the queue.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {pending.map((job) => (
            <QueueCard
              key={job.id}
              job={job}
              busy={busyJobId === job.id}
              onPursue={() => pursue(job.id)}
              onDismiss={() => dismiss(job.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

const EMPTY_PROFILE = {
  ownerId: "",
  name: "",
  email: "",
  targetRoles: [],
  locations: [],
  mustHaves: [],
  dealBreakers: [],
  updatedAt: "",
}

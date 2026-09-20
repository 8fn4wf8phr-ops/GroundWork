"use client"

import { useMemo, useState, type ReactNode } from "react"
import { colors } from "@/lib/theme"
import { useAuth } from "@/lib/auth-context"
import { useApplications } from "@/lib/hooks/use-applications"
import { APPLICATION_STATUSES, type ApplicationStatus, type ApplicationWithJob } from "@/lib/types"
import AddApplicationModal from "@/components/applications/add-application-modal"
import NeedsFollowUpBanner from "@/components/applications/needs-follow-up-banner"
import ApplicationDetailModal from "@/components/applications/application-detail-modal"
import ProfileView from "@/components/profile/profile-view"
import ContactsView from "@/components/contacts/contacts-view"
import { exportApplicationsCsv } from "@/lib/csv"
import ReviewQueueView from "@/components/review-queue/review-queue-view"
import AnalyticsView from "@/components/analytics/analytics-view"
import ResumeView from "@/components/resume/resume-view"

/* ---------- Types ---------- */
type View = "applications" | "review" | "contacts" | "analytics" | "profile" | "resume"

const VIEW_LABELS: Record<View, string> = {
  applications: "Applications",
  review: "Review queue",
  contacts: "Contacts",
  analytics: "Analytics",
  profile: "Profile",
  resume: "Resume",
}

type Pill = { label: string; tone: "teal" | "amber" | "gray" }
type CardData = { id: string; role: string; company: string; pill?: Pill; highlight?: boolean }
type Column = { title: string; cards: CardData[] }
type Entry = { agent: string; agentTone: "teal" | "white"; time: string; message: string }

/* ---------- Live application data -> board columns ---------- */
const CHANNEL_PILL: Record<string, Pill> = {
  cold: { label: "Cold", tone: "gray" },
  referral: { label: "Referral", tone: "teal" },
  "recruiter outreach": { label: "Recruiter", tone: "amber" },
}

function toCardData(app: ApplicationWithJob): CardData {
  return {
    id: app.id,
    role: app.job?.title ?? "Untitled role",
    company: app.job?.company ?? "Unknown company",
    pill: app.channel ? CHANNEL_PILL[app.channel] : undefined,
    highlight: app.status === "Interview" || app.status === "Offer",
  }
}

function buildColumns(applications: ApplicationWithJob[]): Column[] {
  const byStatus = new Map<ApplicationStatus, CardData[]>()
  for (const app of applications) {
    const list = byStatus.get(app.status) ?? []
    list.push(toCardData(app))
    byStatus.set(app.status, list)
  }
  return APPLICATION_STATUSES.filter((status) => byStatus.has(status)).map((status) => ({
    title: status,
    cards: byStatus.get(status)!,
  }))
}

/* ---------- Case file placeholder data ----------
   Not wired yet — this feed comes from the agent roster (Section 8 of the
   spec), which doesn't exist until Scout/Compass/etc. are built. */
const entries: Entry[] = [
  {
    agent: "Compass",
    agentTone: "teal",
    time: "2m ago",
    message: "Scored Cardinal Systems an 8/10 — strong skills overlap, right seniority band.",
  },
  {
    agent: "Scout",
    agentTone: "white",
    time: "2m ago",
    message: "Worth flagging — this exact listing's been reposted three times in two months.",
  },
  {
    agent: "Compass",
    agentTone: "teal",
    time: "1m ago",
    message: "Fair — I don't weight repost history. Dropping it to a 6 until we know more.",
  },
]

/* ---------- Nav rail icons ---------- */
function NavIcon({
  children,
  active,
  onClick,
  label,
}: {
  children: ReactNode
  active?: boolean
  onClick?: () => void
  label?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-11 w-11 items-center justify-center rounded-xl transition-colors"
      style={{
        backgroundColor: active ? colors.teal : "transparent",
        color: active ? colors.bg : colors.muted,
      }}
    >
      {children}
    </button>
  )
}

/* ---------- Small agent avatar (stroke SVG placeholders) ---------- */
function AgentAvatar({ kind, active }: { kind: string; active?: boolean }) {
  const stroke = active ? colors.teal : colors.muted
  return (
    <div
      className="flex h-8 w-8 items-center justify-center rounded-full border"
      style={{ borderColor: active ? colors.teal : colors.border }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {kind === "lamp" && <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10c.5.5 1 1 1 2h6c0-1 .5-1.5 1-2a6 6 0 0 0-4-10Z" />}
        {kind === "binocular" && <><circle cx="7" cy="14" r="4" /><circle cx="17" cy="14" r="4" /><path d="M11 12h2M9 10l1-4h4l1 4" /></>}
        {kind === "compass" && <><circle cx="12" cy="12" r="9" /><path d="m15 9-2 6-4 0 2-6 4 0Z" /></>}
        {kind === "feather" && <><path d="M20 4C13 4 4 11 4 20M4 20l6-6M9 15h7" /></>}
        {kind === "checklist" && <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="m8 9 1.5 1.5L12 8M8 15h8" /></>}
        {kind === "search" && <><circle cx="11" cy="11" r="7" /><path d="m21 21-4-4" /></>}
      </svg>
    </div>
  )
}

/* ---------- Status pill ---------- */
function StatusPill({ pill }: { pill: Pill }) {
  const tones: Record<Pill["tone"], { color: string; bg: string }> = {
    teal: { color: colors.teal, bg: "rgba(53,201,193,0.12)" },
    amber: { color: colors.amber, bg: "rgba(245,166,35,0.12)" },
    gray: { color: colors.muted, bg: "rgba(139,149,161,0.12)" },
  }
  const t = tones[pill.tone]
  return (
    <span
      className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium"
      style={{ color: t.color, backgroundColor: t.bg }}
    >
      {pill.label}
    </span>
  )
}

/* ---------- Application card ---------- */
function ApplicationCard({ app, onClick }: { app: CardData; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-lg border p-3.5 text-left transition-colors hover:border-opacity-80"
      style={{
        backgroundColor: colors.card,
        borderColor: app.highlight ? colors.teal : colors.border,
      }}
    >
      <h3 className="text-sm font-semibold" style={{ color: colors.text }}>
        {app.role}
      </h3>
      <p className="mt-0.5 text-sm" style={{ color: colors.muted }}>
        {app.company}
      </p>
      {app.pill && (
        <div className="mt-2.5">
          <StatusPill pill={app.pill} />
        </div>
      )}
    </button>
  )
}

/* ---------- Kanban column ---------- */
function KanbanColumn({ column, onCardClick }: { column: Column; onCardClick: (id: string) => void }) {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <span className="text-xs font-medium uppercase tracking-wide" style={{ color: colors.muted }}>
        {column.title}
      </span>
      <div className="flex flex-col gap-3">
        {column.cards.map((card) => (
          <ApplicationCard key={card.id} app={card} onClick={() => onCardClick(card.id)} />
        ))}
      </div>
    </div>
  )
}

/* ---------- Case file entry ---------- */
function CaseFileEntry({ entry }: { entry: Entry }) {
  return (
    <li className="flex gap-3">
      <div
        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border"
        style={{ borderColor: colors.border }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={colors.muted} strokeWidth="1.5" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-sm">
          <span className="font-semibold" style={{ color: entry.agentTone === "teal" ? colors.teal : colors.text }}>
            {entry.agent}
          </span>
          <span style={{ color: colors.muted }}>· {entry.time}</span>
        </div>
        <p className="mt-1 text-sm leading-relaxed" style={{ color: colors.text }}>
          {entry.message}
        </p>
      </div>
    </li>
  )
}

/* ---------- Needs your call card ---------- */
function NeedsYourCallCard() {
  return (
    <div
      className="rounded-xl border p-4"
      style={{ borderColor: colors.amber, backgroundColor: "rgba(245,166,35,0.06)" }}
    >
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colors.amber }} />
        <span className="text-sm font-semibold" style={{ color: colors.amber }}>
          Needs your call
        </span>
      </div>
      <p className="mt-2.5 text-sm leading-relaxed" style={{ color: colors.text }}>
        Lens flagged referrals converting 3x better this month — Ledger says that&apos;s only two data points, not
        enough to trust yet. Want Lens to keep surfacing this, or wait for more data?
      </p>
      <div className="mt-4 flex flex-wrap gap-2.5">
        <button
          type="button"
          className="rounded-md px-3.5 py-1.5 text-sm font-semibold transition-opacity hover:opacity-90"
          style={{ backgroundColor: colors.amber, color: colors.bg }}
        >
          Keep surfacing
        </button>
        <button
          type="button"
          className="rounded-md border px-3.5 py-1.5 text-sm font-medium transition-colors"
          style={{ borderColor: colors.border, color: colors.text }}
        >
          Wait for more data
        </button>
      </div>
    </div>
  )
}

/* ---------- User menu ---------- */
function UserMenu() {
  const { user, signOutUser } = useAuth()
  if (!user) return null
  return (
    <div className="flex items-center gap-2.5">
      <span className="hidden text-sm sm:inline" style={{ color: colors.muted }}>
        {user.email}
      </span>
      <button
        type="button"
        onClick={() => signOutUser()}
        className="rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors hover:opacity-90"
        style={{ borderColor: colors.border, color: colors.text }}
      >
        Sign out
      </button>
    </div>
  )
}

/* ---------- Main component ---------- */
export default function ApplicationsDashboard() {
  const { user } = useAuth()
  const [view, setView] = useState<View>("applications")
  const { applications, loading } = useApplications()
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const columns = useMemo(() => buildColumns(applications), [applications])
  const activeCount = applications.filter(
    (a) => a.status !== "Offer" && a.status !== "Rejected" && a.status !== "Withdrawn",
  ).length
  const selectedApplication = applications.find((a) => a.id === selectedId)

  return (
    <div
      className="flex min-h-screen font-sans"
      style={{ backgroundColor: colors.bg, color: colors.text, fontFamily: "var(--font-inter)" }}
    >
      {/* Left icon rail */}
      <nav
        className="flex w-[72px] shrink-0 flex-col items-center gap-3 border-r py-4"
        style={{ borderColor: colors.border, backgroundColor: colors.bg }}
        aria-label="Primary"
      >
        <NavIcon active={view === "applications"} onClick={() => setView("applications")} label="Applications">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m5 12 5 5L20 7" />
          </svg>
        </NavIcon>
        <NavIcon active={view === "review"} onClick={() => setView("review")} label="Review queue">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" />
          </svg>
        </NavIcon>
        <NavIcon active={view === "contacts"} onClick={() => setView("contacts")} label="Contacts">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18" />
          </svg>
        </NavIcon>
        <NavIcon active={view === "analytics"} onClick={() => setView("analytics")} label="Analytics">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
          </svg>
        </NavIcon>
        <NavIcon active={view === "profile"} onClick={() => setView("profile")} label="Profile">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
          </svg>
        </NavIcon>
        <NavIcon active={view === "resume"} onClick={() => setView("resume")} label="Resume">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6" />
          </svg>
        </NavIcon>
      </nav>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header bar */}
        <header
          className="flex flex-wrap items-center justify-between gap-4 border-b px-6 py-4"
          style={{ borderColor: colors.border }}
        >
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold" style={{ color: colors.text, fontFamily: "var(--font-space-grotesk)" }}>
              Groundwork
            </h1>
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: colors.teal }} />
            <span className="text-sm" style={{ color: colors.muted }}>
              {VIEW_LABELS[view]}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <AgentAvatar kind="lamp" />
              <AgentAvatar kind="binocular" />
              <AgentAvatar kind="compass" active />
              <AgentAvatar kind="feather" />
              <AgentAvatar kind="checklist" />
              <AgentAvatar kind="search" active />
            </div>
            {view === "applications" && (
              <button
                type="button"
                className="rounded-lg px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
                style={{ backgroundColor: colors.teal, color: colors.bg }}
              >
                Review 3 new matches
              </button>
            )}
            <UserMenu />
          </div>
        </header>

        {view === "profile" ? (
          <ProfileView />
        ) : view === "contacts" ? (
          <ContactsView applications={applications} />
        ) : view === "review" ? (
          <ReviewQueueView />
        ) : view === "analytics" ? (
          <AnalyticsView />
        ) : view === "resume" ? (
          <ResumeView />
        ) : (
        /* Two-panel body */
        <div className="flex flex-1 flex-col lg:flex-row">
          {/* Left panel — Applications kanban */}
          <section className="min-w-0 flex-1 border-b p-6 lg:border-b-0 lg:border-r" style={{ borderColor: colors.border }}>
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold" style={{ color: colors.text, fontFamily: "var(--font-space-grotesk)" }}>
                Applications
              </h2>
              <div className="flex items-center gap-3">
                <span className="text-sm" style={{ color: colors.muted }}>
                  {loading ? "Loading…" : `${activeCount} active`}
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddModal(true)}
                  className="rounded-md border px-3 py-1.5 text-sm font-medium transition-colors hover:opacity-90"
                  style={{ borderColor: colors.border, color: colors.text }}
                >
                  + Add application
                </button>
                <button
                  type="button"
                  disabled={!user || applications.length === 0}
                  onClick={() => user && exportApplicationsCsv(user.uid, applications)}
                  className="rounded-md border px-3 py-1.5 text-sm font-medium transition-colors hover:opacity-90 disabled:opacity-50"
                  style={{ borderColor: colors.border, color: colors.text }}
                >
                  Export CSV
                </button>
              </div>
            </div>
            {!loading && <NeedsFollowUpBanner applications={applications} onSelect={setSelectedId} />}
            {!loading && columns.length === 0 ? (
              <div
                className="rounded-lg border border-dashed p-8 text-center text-sm"
                style={{ borderColor: colors.border, color: colors.muted }}
              >
                No applications yet — add one to start tracking.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {columns.map((column) => (
                  <KanbanColumn key={column.title} column={column} onCardClick={setSelectedId} />
                ))}
              </div>
            )}
          </section>

          {/* Right panel — Case file */}
          <aside className="w-full shrink-0 p-6 lg:w-[420px]">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold" style={{ color: colors.text, fontFamily: "var(--font-space-grotesk)" }}>
                Case file
              </h2>
              <span className="flex items-center gap-1.5 text-sm" style={{ color: colors.muted }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: colors.teal }} />
                Live
              </span>
            </div>
            <ul className="flex flex-col gap-5">
              {entries.map((entry, i) => (
                <CaseFileEntry key={i} entry={entry} />
              ))}
            </ul>
            <div className="mt-5">
              <NeedsYourCallCard />
            </div>
          </aside>
        </div>
        )}
      </div>

      {showAddModal && <AddApplicationModal onClose={() => setShowAddModal(false)} />}
      {selectedApplication && (
        <ApplicationDetailModal
          application={selectedApplication}
          allApplications={applications}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  )
}

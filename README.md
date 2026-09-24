# Groundwork

A personal job-search assistant: discovers postings from compliant, public
job-source APIs, scores them against your profile, and tracks every
application from first contact through offer — while you always make the
final call on what gets pursued and what gets submitted.

Full product vision, scope guardrails, and data model: see
[`groundwork-spec.md`](../groundwork-spec.md) (one directory up from this
repo). This README covers what's actually built and how to run it.
[`JOURNEY.md`](./JOURNEY.md) is a narrative log of how it got built,
including the real bugs hit along the way.

## Status

**Phase 1 (Foundation) — complete.** Auth, the full Firestore data model,
manual application entry with duplicate detection, application detail
editing, Profile, Contacts, CSV export.

**Phase 2 (Discovery + Matching) — complete.** Review Queue with
pursue/dismiss, keyword-overlap match scoring, all 7 spec-listed job
sources wired (Arbeitnow, Adzuna, RemoteOK, Jobicy, The Muse, USAJobs,
We Work Remotely). Pulling is a manual "Pull new postings" click, or
opt-in daily via Vercel Cron — see [Scheduling](#scheduling-daily-opt-in)
below.

**Also complete:** the real six-agent system (Compass, Scout, Sage,
Quill, Ledger, Lens — see JOURNEY.md §15-17), structured Resume storage,
resume/cover-letter tailoring, follow-up reminders, referral/channel
Analytics, and portfolio project sync.

**Not started:** the browser extension.

## Tech stack

- **Next.js 16** (App Router) + React 19 + TypeScript, Tailwind for styling
- **Firebase Authentication** — email/password + Google sign-in
- **Firestore** — Profile, Job, Application, Contact collections, all
  scoped by `ownerId` via security rules (see [`firestore.rules`](./firestore.rules))
- **Next.js Route Handlers** for server-side API calls that need a real
  secret key (currently just Adzuna) — see
  [Why Adzuna needs a server route](#why-adzuna-needs-a-server-route)

## Getting started

### 1. Firebase project

1. Create a project at the [Firebase console](https://console.firebase.google.com/).
2. **Build → Authentication → Get started** — enable **Email/Password**
   and **Google** sign-in.
3. **Build → Firestore Database → Create database** — production mode.
4. In Firestore's **Rules** tab, paste the contents of
   [`firestore.rules`](./firestore.rules) and publish. Skipping this
   step means every read/write fails with `permission-denied` — the
   database defaults to locked, not open.
5. Add a web app (Project settings → General → Your apps) to get the six
   config values for step 3 below.

### 2. Adzuna (optional — only needed for that one source)

Register for a free API key at [developer.adzuna.com](https://developer.adzuna.com/).
You'll get an **App ID** and **App Key**.

### 3. Environment variables

```bash
cp .env.local.example .env.local
```

Fill in the six `NEXT_PUBLIC_FIREBASE_*` values from Firebase, and (if
using Adzuna) `ADZUNA_APP_ID` / `ADZUNA_APP_KEY`. `.env.local` is
gitignored — never commit it.

### 4. Install and run

```bash
npm install
npm run dev
```

Opens at `http://localhost:3000`. First run: sign up, fill out your
Profile (target roles matter — match scoring is meaningless without
them), then use the Review Queue to pull postings.

## Why Adzuna needs a server route

Firebase's client config (`NEXT_PUBLIC_FIREBASE_*`) is meant to be
public — access is enforced by Firestore's security rules, not by
hiding the config. Adzuna's `app_key` is different: it's a real secret
tied to your account's rate quota, with nothing downstream protecting
it. Shipping it in a `NEXT_PUBLIC_*` var would let anyone pull it out of
the browser bundle and burn your quota. `app/api/discovery/adzuna/route.ts`
holds the key server-side; the browser calls that route instead of
`api.adzuna.com` directly. USAJobs needs the same treatment for the same
reason (`app/api/discovery/usajobs/route.ts`). Arbeitnow, RemoteOK, and
Jobicy need no key at all, so they're called directly from the browser —
but We Work Remotely, despite also needing no key, still goes through
`app/api/discovery/wwr/route.ts`: it has no CORS header (confirmed live),
so a browser fetch to `weworkremotely.com` is blocked regardless.

## Scheduling (daily, opt-in)

The manual "Pull new postings" button always works. Separately, a user can
turn on **Daily discovery** in the Profile view; a Vercel Cron job
(`vercel.json`, 13:00 UTC) then calls `/api/cron/discover`, which for each
opted-in user pulls from whichever of the seven sources they've checked
(Adzuna, Arbeitnow, RemoteOK, Jobicy, The Muse, USAJobs, We Work
Remotely), keeps only postings that score 30+ against their Profile
(max 25 a day), and has Compass/Scout comment on the top three in the
Case File. It never applies to anything.

This needs no Blaze plan — it's a Next.js route, not a Cloud Function —
but it does need two server-only secrets (see `.env.local.example`); a third,
`USAJOBS_API_KEY`/`USAJOBS_USER_AGENT`, is only needed if USAJobs is one
of the checked sources:

- `CRON_SECRET` — Vercel sends it as a Bearer token; the route refuses
  every request without it (and refuses all requests if it's unset).
- `FIREBASE_SERVICE_ACCOUNT` — a service-account key. The server has no
  signed-in user, so it uses the Firebase Admin SDK, which **bypasses
  Firestore security rules**. Every query in `lib/server/admin-store.ts`
  is therefore scoped to the owner by hand. Treat the key like a password
  and mark it Sensitive on Vercel.

To try it without waiting for the cron: with both set,
`curl -H "Authorization: Bearer $CRON_SECRET" "https://<your-app>/api/cron/discover?force=1"`
(`force=1` skips the once-per-20-hours guard).

## Project structure

```
app/
  api/discovery/*/route.ts        — server-side proxies (Adzuna, USAJobs, We Work Remotely)
  api/agents/*                    — agent routes (require a signed-in user)
  api/cron/discover/route.ts      — daily discovery (Vercel Cron only)
  layout.tsx, page.tsx            — wraps the app in AuthProvider
components/
  applications-dashboard.tsx      — the shell: nav rail, header, view switch
  applications/                   — add/edit application modals
  auth/                           — sign-in screen, auth gate
  contacts/                       — contacts view + modal
  profile/                        — profile form + tag input
  review-queue/                   — discovery review queue
lib/
  auth-context.tsx                — AuthProvider / useAuth
  firebase.ts                     — Firebase app init
  types.ts                        — the full data model (spec §4)
  discovery/                      — one module per job source
  matching/score.ts               — the match-scoring algorithm
  firestore/                      — all Firestore reads/writes, by collection
    sanitize.ts                   — shared fix for a recurring Firestore
                                     bug (see JOURNEY.md)
  hooks/                          — live-subscription React hooks
firestore.rules                   — ownerId-scoped security rules
```

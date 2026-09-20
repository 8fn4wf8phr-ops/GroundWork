# The build, in order

This is a log of how Groundwork's dashboard went from a v0-generated
static mockup to a working app wired against a real Firebase project and
real third-party job APIs — including the bugs that live testing caught,
because most of them wouldn't have shown up in a type-check.

A theme worth naming up front: almost nothing here was declared done on
the strength of `tsc --noEmit` or a clean build alone. Every feature was
driven end-to-end with a real signed-up account against the real Firebase
project and, once Discovery started, real live API calls — no mocks. That
discipline is what actually caught the bugs below; several of them
compiled fine and looked correct on read-through.

## 1. Starting point

A single-file React component (`applications-dashboard.tsx`) with
hardcoded placeholder data — a kanban board and a "case file" agent feed,
styled but not connected to anything. No auth, no backend, no data model.

## 2. Authentication

Wired Firebase Auth (email/password + Google) with an `AuthProvider` /
`useAuth()` context, a sign-in screen matching the existing dark theme,
and an `AuthGate` that shows loading → sign-in → dashboard based on auth
state.

**First bug:** sign-up failed with `CONFIGURATION_NOT_FOUND`. Not a code
bug — Authentication had never been switched on in the Firebase console
for that project. The client SDK config was fine; the product itself
wasn't initialized. Once enabled (Email/Password + Google), full
sign-up → sign-out → sign-in verified via headless browser test.

## 3. The Firestore data model

Built out `Profile`, `Job`, `Application`, `Contact` per spec §4, all
scoped by `ownerId`, with `firestore.rules` denying everything by
default except to the owning user.

**Second bug:** a fresh Firestore database defaults to *locked* rules
(`allow read, write: if false`), not open test-mode. Every read failed
with `permission-denied` until the real rules were published — a
reminder that "no rules file yet" and "wrong rules" fail identically
from the client's point of view.

**Third bug, later:** Profile documents are keyed by the user's own uid
(a true singleton, not a queried collection). The first rule for that
collection checked `resource.data.ownerId` — which throws when
`resource` is `null`, which it is on a `get` against a document that
doesn't exist yet (a first-time user's Profile). That looks identical to
`permission-denied` from the outside. Fixed by checking the path itself
(`request.auth.uid == profileId`) instead of the document's contents —
a rule that doesn't need to read a document can't break on that
document not existing.

## 4. Applications board, detail view, duplicate detection, CSV export

Replaced the hardcoded kanban columns with a live join of `Application` +
`Job` documents. Added a manual "Add application" flow (Job and
Application created together, since there's no separate discovery step
for a manually-entered posting), a detail modal for editing
status/channel/dates/notes/rejection reason, duplicate detection (spec
§6 — same company + title within 90 days, with an explicit "add it
anyway" override), and CSV export.

**Fourth bug, and a recurring one:** editing an application's rejection
reason (left blank) threw "Couldn't save" with no useful message.
Firestore's `updateDoc` **throws** on any field whose value is literally
`undefined` — it doesn't drop the field, it rejects the whole write. The
form's "empty optional field" pattern (`value || undefined`) produced
exactly that. This exact bug reappeared independently in Contact updates
and then in Profile saves — three separate write paths, same root cause,
before it got centralized into one `sanitizeForFirestore()` helper
(`lib/firestore/sanitize.ts`) that every write path now goes through.

## 5. Profile and real navigation

Added the `Profile` view (contact info, target roles, locations, salary
floor, must-haves, deal-breakers) and made the dashboard's left nav rail
actually switch views — it had been decorative up to this point.

## 6. Contacts

Added the `Contact` collection, a Contacts view, and a way to link/unlink
existing contacts to a specific Application from its detail modal
(`arrayUnion`/`arrayRemove` on `Contact.applicationIds`).

## 7. Discovery: Arbeitnow, and the scoring algorithm

This is where the fourth-bug pattern showed up again, in a more
interesting shape.

Built `computeMatchScore()` — the keyword-overlap algorithm spec §17
explicitly left as an open design question: title-vs-target-role overlap
(0–50 pts), location/remote fit (0–25), must-have keyword hits (0–25),
each with a human-readable reason string, plus deal-breakers flagged
separately rather than folded into the score.

Wired Arbeitnow (confirmed live: no API key, CORS-open, stable JSON
shape) as the first source, with a Review Queue view (pursue/dismiss,
sorted by score) and dedup by the source's own posting id.

**Fifth bug, the interesting one:** every real posting scored 0% —
including obvious matches like "Senior Software Engineer" against a
target role of "Engineer." Looked like a scoring bug. It wasn't:
`computeMatchScore()` tested correctly in complete isolation, in a plain
Node script with no Firestore and no React, which ruled out the scoring
logic entirely in under a minute. The actual break was one layer up —
`saveProfile()` had the exact same `value || undefined` bug from Section
4, so a Profile with any blank optional field (phone, salary floor)
silently failed to save. `useProfile()` correctly returned `null` (there
genuinely was no Profile document), and scoring against an empty profile
correctly produced 0%. The bug wasn't in the function under suspicion —
it was in a completely different subsystem one layer removed, and the
fastest way to find that was eliminating the suspected layer first by
testing it alone.

## 8. Discovery: Adzuna

Adzuna needed real registration (App ID + App Key) and, unlike Arbeitnow,
its `app_key` is a genuine secret tied to the account's rate quota — not
something to expose via a `NEXT_PUBLIC_*` var the way Firebase's client
config safely is. Added `app/api/discovery/adzuna/route.ts`, a Next.js
Route Handler that holds the key server-side; the browser calls that
route instead of `api.adzuna.com` directly. No Cloud Function or Blaze
upgrade needed — Next.js's own server-side routes were enough.

Verified live with real credentials: confirmed Adzuna's `what` param
actually filters server-side (unlike Arbeitnow's `search`, which is
silently ignored), so `fetchAdzunaJobsForProfile()` queries per target
role (capped at 3) rather than pulling everything and scoring after.

## 9. Discovery: RemoteOK and Jobicy

Two more keyless, CORS-open sources, confirmed live before writing any
code against them (same discipline as Arbeitnow and Adzuna — check the
real response shape and CORS headers first, never guess). Jobicy's `tag`
param turned out to genuinely filter (confirmed with a live multi-word
query), so it gets the same per-role querying treatment as Adzuna.
Extracted the HTML-stripping helper (every source returns HTML
descriptions; none of it is ever rendered as HTML — always stripped to
plain text first) into `lib/discovery/strip-html.ts` once a third source
needed it.

With four sources in the Review Queue's source picker, the UI moved from
one button per source to a single source dropdown + one "Pull new
postings" button — four hardcoded buttons was the point where that
stopped being the right shape.

## What this leaves for next time

- **USAJobs** — needs registration (government API key).
- **The Muse** — public and keyless, but its category-filtering taxonomy
  didn't resolve on the first attempt (`category=Engineering` returned
  zero results) and wasn't worth guessing further at without a working
  example to test against.
- **We Work Remotely** — no real JSON API found, RSS-based.
- **Resume storage** and **scheduled (Cloud Function) discovery** — both
  gated on upgrading the Firebase project to the Blaze plan, a real
  billing decision left for whenever that tradeoff is worth making.

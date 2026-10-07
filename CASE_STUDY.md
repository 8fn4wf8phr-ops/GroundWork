# Groundwork: a job-search tracker that argues with itself

**[Live demo](https://groundwork-six-ochre.vercel.app/demo) · [Source](https://github.com/8fn4wf8phr-ops/GroundWork)**

Most job-search trackers are a spreadsheet with extra steps: you still do
the discovery, the scoring, the "should I apply to this" judgment calls
yourself. Groundwork does the mechanical parts — pulling postings from
seven job boards, scoring them against your resume, tracking every
application through offer — and hands you the judgment calls instead of
making them for you.

## The one decision that shaped everything else

Early on I had to decide what "AI-powered" actually meant here, instead of
leaving it as a vague selling point. The answer: Compass and Scout, two
Claude-backed agents with different jobs, narrate a deterministic match
score and sometimes **disagree with each other** — Scout flags a real
concern (a company reposting the same listing across boards, a
suspiciously short description), Compass weighs it against the posting's
actual content, and if they don't converge, it escalates to you as a
"needs your call" card instead of silently picking a side. The agents
never invent the underlying facts — the match score is a real, computed
number; the agents narrate and reason about it, never override it. That
one design constraint (compute first, narrate second, never let the model
invent a number) ended up disciplining almost every other agent I added
later: Quill selects real resume bullets by ID rather than rewriting them
from scratch, Herald appends real project links deterministically after
its own generated text so a URL can never drift wrong.

## Seven agents, not one chatbot

- **Compass** scores and narrates matches; **Scout** is its built-in
  skeptic.
- **Quill** tailors a resume/cover letter per posting by selecting and
  reordering real content, never generating fabricated experience.
- **Sage** checks in when your profile has an objective gap (no target
  roles, target roles you have no matching experience for) — not a vague
  "how's it going," two specific, checkable triggers.
- **Ledger** narrates real status changes across both Applications and
  Outreach.
- **Lens** surfaces statistically-interesting patterns in your own
  response data (a channel that's converting 3x better, a source that's
  pure noise) and knows when a sample is too small to trust.
- **Herald** drafts cold outreach in a deliberately different voice from
  Quill — warmer, shorter, assumes no application exists yet — and writes
  its own short follow-up nudge automatically when a thread goes cold.

## Problems worth describing, not just features

**The scoring rubric had a real bug, not just a missing feature.**
Staff/Principal/Director postings were landing at 55-75% match because
the scoring only ever checked for role-name overlap, never seniority
tier. The fix wasn't a bigger model — it was a small, explainable,
testable penalty applied to the deterministic score, verified against
exact before/after numbers rather than a vibe.

**A real security gap in Firestore rules.** Every per-user collection
checked who owned a document *before* a write — but never validated what
the write changed `ownerId` *to*. I verified this live against the real
database (not just by reading the rules file) by minting two accounts and
proving a PATCH request could reassign a document's ownership. The fix is
a one-line rule addition; finding it required actually trying to break
the thing, not just reading the code and assuming it was fine.

**Cost control that's actually load-bearing.** Seven job sources means a
lot of postings, and every one that reaches the review queue *could*
trigger an LLM call for commentary. Cheap, deterministic rules run first
— only postings that clear a real bar get narrated — which keeps API
spend proportional to what the user will actually look at, not to how
much the discovery crawler happened to find that day.

## What's live today

All seven job sources (Arbeitnow, Adzuna, RemoteOK, Jobicy, The Muse,
USAJobs, We Work Remotely), the full seven-agent system, resume/cover-
letter tailoring, cold-outreach drafting, scheduled daily discovery,
email notifications, a mobile layout with keyboard shortcuts, and
optional error monitoring — built on Next.js 16, Firebase, and the Claude
API, deployed on Vercel.

[See it yourself](https://groundwork-six-ochre.vercel.app/demo) — no
account needed.

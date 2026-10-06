import * as Sentry from "@sentry/nextjs"

// Browser-side errors — a real crash in the React tree, an unhandled
// promise rejection — reported alongside the server/edge errors from
// sentry.server.config.ts / sentry.edge.config.ts. Same opt-in-when-
// configured reasoning: a no-op until NEXT_PUBLIC_SENTRY_DSN is set.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  // Session replay is Sentry's default suggestion here, but this app
  // handles real job-search data (resumes, applications, outreach
  // contacts) — recording user sessions adds a privacy surface this
  // project hasn't asked for. Skipped.
})

import * as Sentry from "@sentry/nextjs"

// Edge runtime (middleware, if this project ever adds any) — same
// opt-in-when-configured reasoning as sentry.server.config.ts.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
})

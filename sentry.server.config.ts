import * as Sentry from "@sentry/nextjs"

// Same opt-in-when-configured pattern as every other integration in this
// project (Resend, the Anthropic key, USAJobs) — Sentry.init() with no dsn
// is a documented no-op, so this is safe to run unconditionally even when
// NEXT_PUBLIC_SENTRY_DSN is unset. The DSN itself isn't a secret (Sentry
// designs it to be safely public, same as Firebase's client config), so
// it's a NEXT_PUBLIC_ var rather than a server-only one.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
})

// @sentry/nextjs v11 moved withSentryConfig to a separate build-time-only
// subpath, out of the main package export (confirmed live — the top-level
// import has no withSentryConfig at all in this version, by design: the
// main entry is the runtime SDK, this one is the next.config.js helper).
import { withSentryConfig } from '@sentry/nextjs/config'

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

// org/project/authToken only matter for uploading source maps at build
// time (so a stack trace in Sentry shows real file/line instead of
// minified output) — all optional, and the plugin skips that step
// quietly without an authToken rather than failing the build. Error
// reporting itself only needs the DSN (sentry.server.config.ts etc.),
// which these don't gate.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  widenClientFileUpload: true,
})

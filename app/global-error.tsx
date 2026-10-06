"use client"

import { useEffect } from "react"
import * as Sentry from "@sentry/nextjs"

// Catches an error in the ROOT layout itself — a normal error.tsx can't,
// since it renders inside the layout it'd be replacing. This project has
// no error.tsx at all yet (every current error path is caught inline by
// its own component, per the error-toast work elsewhere in this change),
// so this is purely a last-resort net plus Sentry reporting for the one
// class of crash nothing else can catch.
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html>
      <body style={{ backgroundColor: "#0E1116", color: "#E8ECF1", fontFamily: "sans-serif" }}>
        <div style={{ maxWidth: 480, margin: "80px auto", padding: "0 24px", textAlign: "center" }}>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>Something went wrong.</h1>
          <p style={{ marginTop: 8, color: "#8B95A1", fontSize: 14 }}>
            This has been reported. Try reloading the page.
          </p>
        </div>
      </body>
    </html>
  )
}

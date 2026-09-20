"use client"

import { useAuth } from "@/lib/auth-context"
import { colors } from "@/lib/theme"
import SignInScreen from "@/components/auth/sign-in-screen"
import ApplicationsDashboard from "@/components/applications-dashboard"

export default function AuthGate() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center font-sans"
        style={{ backgroundColor: colors.bg, color: colors.muted, fontFamily: "var(--font-inter)" }}
      >
        <span className="text-sm">Loading…</span>
      </div>
    )
  }

  if (!user) {
    return <SignInScreen />
  }

  return <ApplicationsDashboard />
}

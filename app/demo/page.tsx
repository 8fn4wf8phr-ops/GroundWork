import type { Metadata } from "next"
import DemoDashboard from "@/components/demo/demo-dashboard"

export const metadata: Metadata = {
  title: "Groundwork — Live demo",
  description: "A no-login walkthrough of Groundwork with sample data — try the review queue, kanban board, and analytics.",
}

// No AuthProvider gate, no Firestore, no Anthropic key — this route
// renders DemoDashboard directly rather than going through
// components/auth/auth-gate.tsx the way "/" does.
export default function DemoPage() {
  return <DemoDashboard />
}

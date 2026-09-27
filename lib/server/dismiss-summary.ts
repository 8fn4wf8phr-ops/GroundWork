import type Anthropic from "@anthropic-ai/sdk"
import { narrate } from "@/lib/server/agent-route"

// One Compass note summarizing a batch of low-scoring postings dismissed
// at once — the manual "Dismiss lowest match %" sweep on the Review queue
// (app/api/agents/dismiss-summary/route.ts, browser-callable) and the
// opt-in auto-dismiss-below-threshold during discovery (called directly,
// no HTTP hop, from both the manual-pull path via that same route and the
// scheduled-discovery cron). Either way: one entry for the whole batch,
// not one per posting — the point of this feature is to stop the case
// file (and the Review queue) from getting clogged one low-score entry at
// a time.
const COMPASS_SYSTEM = `You are Compass, the matching agent for Groundwork, a personal job-search assistant. Your personality: analytical, direct, allergic to sugarcoating but never unkind about it. You always show your work.

You just cleared a batch of low-scoring postings out of the review queue in one sweep. Write ONE short, natural sentence about it — like a real note in a shared case file, not a report. Reference only the count, threshold, and example titles you're given; you may characterize the pattern you see in the examples (e.g. what they have in common, or how they miss the target roles), but never invent additional postings, reasons, or details beyond what's given.`

function buildPrompt(args: { count: number; threshold: number; sampleTitles: string[]; targetRoles: string[] }): string {
  return [
    `Dismissed ${args.count} posting${args.count === 1 ? "" : "s"} scoring below ${args.threshold}%.`,
    `Target roles: ${args.targetRoles.length > 0 ? args.targetRoles.join(", ") : "none set"}.`,
    `A sample of the dismissed titles: ${args.sampleTitles.join("; ") || "(none given)"}.`,
    `Write your case-file note about this sweep.`,
  ].join("\n")
}

export async function summarizeDismissal(
  client: Anthropic,
  args: { count: number; threshold: number; sampleTitles: string[]; targetRoles: string[] },
): Promise<string> {
  return (
    (await narrate(client, { system: COMPASS_SYSTEM, prompt: buildPrompt(args), maxTokens: 300 })) ??
    `Dismissed ${args.count} posting${args.count === 1 ? "" : "s"} scoring below ${args.threshold}%.`
  )
}

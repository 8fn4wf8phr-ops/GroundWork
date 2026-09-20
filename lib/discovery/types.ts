import type { Job } from "@/lib/types"

// The shape every source module normalizes its postings into, before
// lib/firestore/jobs.ts scores and writes them. Shared across sources so
// saveDiscoveredJobs and the match scorer don't need to know which API a
// posting came from.
export type DiscoveredJob = Omit<
  Job,
  "id" | "ownerId" | "dateDiscovered" | "matchScore" | "matchReasons" | "reviewStatus"
>

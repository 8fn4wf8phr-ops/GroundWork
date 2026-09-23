import { z } from "zod"
import { agentRoute } from "@/lib/server/agent-route"
import { MAX_JOBS_PER_REVIEW, ReviewJobSchema, ReviewProfileSchema, reviewJobs } from "@/lib/server/review-jobs"

// Server-side only — ANTHROPIC_API_KEY is a real secret tied to billing,
// same reasoning as the Adzuna key (see app/api/discovery/adzuna/route.ts).
// Auth, size limits and error handling live in lib/server/agent-route.ts;
// the Compass/Scout exchange itself lives in lib/server/review-jobs.ts.
const RequestSchema = z.object({
  jobs: z.array(ReviewJobSchema).max(MAX_JOBS_PER_REVIEW),
  profile: ReviewProfileSchema,
})

export const POST = agentRoute({ name: "Agent review", schema: RequestSchema }, async ({ client, body }) => ({
  entries: await reviewJobs(client, body.jobs, body.profile),
}))

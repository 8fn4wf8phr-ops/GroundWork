"use client"

import { useEffect, useMemo, useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { subscribeToApplications } from "@/lib/firestore/applications"
import { subscribeToJobs } from "@/lib/firestore/jobs"
import type { Application, Job } from "@/lib/types"

// The review queue is Jobs with no Application yet and not dismissed —
// there's no separate "queue" collection, it's a derived view over Jobs
// and Applications (spec Section 9).
export function useReviewQueue() {
  const { user } = useAuth()
  const [jobs, setJobs] = useState<Job[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setJobs([])
      setApplications([])
      setLoading(false)
      return
    }
    setLoading(true)
    let jobsLoaded = false
    let appsLoaded = false
    const maybeDoneLoading = () => {
      if (jobsLoaded && appsLoaded) setLoading(false)
    }
    const unsubJobs = subscribeToJobs(user.uid, (j) => {
      setJobs(j)
      jobsLoaded = true
      maybeDoneLoading()
    })
    const unsubApps = subscribeToApplications(user.uid, (a) => {
      setApplications(a)
      appsLoaded = true
      maybeDoneLoading()
    })
    return () => {
      unsubJobs()
      unsubApps()
    }
  }, [user])

  const pending = useMemo(() => {
    const appliedJobIds = new Set(applications.map((a) => a.jobId))
    return jobs
      .filter((j) => j.reviewStatus !== "dismissed" && !appliedJobIds.has(j.id))
      .sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0))
  }, [jobs, applications])

  return { pending, loading }
}

"use client"

import { useEffect, useMemo, useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { subscribeToApplications } from "@/lib/firestore/applications"
import { subscribeToJobs } from "@/lib/firestore/jobs"
import type { Application, ApplicationWithJob, Job } from "@/lib/types"

// Two live Firestore subscriptions (applications, jobs) joined client-side
// by jobId. Splitting them keeps each query a single ownerId equality
// filter — no composite index required — rather than one subscription
// per application, which wouldn't scale past a handful of rows.
export function useApplications() {
  const { user } = useAuth()
  const [applications, setApplications] = useState<Application[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setApplications([])
      setJobs([])
      setLoading(false)
      return
    }
    setLoading(true)
    let appsLoaded = false
    let jobsLoaded = false
    const maybeDoneLoading = () => {
      if (appsLoaded && jobsLoaded) setLoading(false)
    }

    const unsubApps = subscribeToApplications(user.uid, (apps) => {
      setApplications(apps)
      appsLoaded = true
      maybeDoneLoading()
    })
    const unsubJobs = subscribeToJobs(user.uid, (js) => {
      setJobs(js)
      jobsLoaded = true
      maybeDoneLoading()
    })

    return () => {
      unsubApps()
      unsubJobs()
    }
  }, [user])

  const applicationsWithJobs = useMemo<ApplicationWithJob[]>(() => {
    const jobsById = new Map(jobs.map((j) => [j.id, j]))
    return applications.map((app) => ({ ...app, job: jobsById.get(app.jobId) }))
  }, [applications, jobs])

  return { applications: applicationsWithJobs, loading }
}

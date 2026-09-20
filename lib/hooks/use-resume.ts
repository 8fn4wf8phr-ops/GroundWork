"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { subscribeToResume } from "@/lib/firestore/resume"
import type { Resume } from "@/lib/types"

export function useResume() {
  const { user } = useAuth()
  const [resume, setResume] = useState<Resume | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setResume(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const unsubscribe = subscribeToResume(user.uid, (r) => {
      setResume(r)
      setLoading(false)
    })
    return unsubscribe
  }, [user])

  return { resume, loading }
}

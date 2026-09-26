"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { subscribeToOutreach } from "@/lib/firestore/outreach"
import type { Outreach } from "@/lib/types"

export function useOutreach() {
  const { user } = useAuth()
  const [outreach, setOutreach] = useState<Outreach[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setOutreach([])
      setLoading(false)
      return
    }
    setLoading(true)
    const unsubscribe = subscribeToOutreach(user.uid, (o) => {
      setOutreach(o)
      setLoading(false)
    })
    return unsubscribe
  }, [user])

  return { outreach, loading }
}

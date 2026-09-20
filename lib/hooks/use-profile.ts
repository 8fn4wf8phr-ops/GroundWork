"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { subscribeToProfile } from "@/lib/firestore/profile"
import type { Profile } from "@/lib/types"

export function useProfile() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setProfile(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const unsubscribe = subscribeToProfile(user.uid, (p) => {
      setProfile(p)
      setLoading(false)
    })
    return unsubscribe
  }, [user])

  return { profile, loading }
}

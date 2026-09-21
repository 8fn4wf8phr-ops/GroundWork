"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { subscribeToCaseFile } from "@/lib/firestore/case-file"
import type { CaseFileEntry } from "@/lib/types"

export function useCaseFile() {
  const { user } = useAuth()
  const [entries, setEntries] = useState<CaseFileEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setEntries([])
      setLoading(false)
      return
    }
    setLoading(true)
    const unsubscribe = subscribeToCaseFile(user.uid, (e) => {
      setEntries(e)
      setLoading(false)
    })
    return unsubscribe
  }, [user])

  return { entries, loading }
}

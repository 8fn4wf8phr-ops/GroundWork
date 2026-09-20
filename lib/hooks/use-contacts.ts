"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { subscribeToContacts } from "@/lib/firestore/contacts"
import type { Contact } from "@/lib/types"

export function useContacts() {
  const { user } = useAuth()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setContacts([])
      setLoading(false)
      return
    }
    setLoading(true)
    const unsubscribe = subscribeToContacts(user.uid, (c) => {
      setContacts(c)
      setLoading(false)
    })
    return unsubscribe
  }, [user])

  return { contacts, loading }
}

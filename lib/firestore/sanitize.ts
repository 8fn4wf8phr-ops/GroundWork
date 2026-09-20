// Firestore's setDoc/updateDoc throw (not silently drop) on any field
// whose value is literally `undefined` — easy to produce from "empty
// optional field" form state like `phone || undefined`. This exact bug
// has shown up independently in three different write paths
// (Application updates, Contact updates, Profile saves); centralizing
// the fix here so the next one gets it for free instead of repeating it.
export function sanitizeForFirestore<T extends Record<string, unknown>>(obj: T): T {
  const result = {} as T
  for (const [key, value] of Object.entries(obj)) {
    ;(result as Record<string, unknown>)[key] = value === "" || value === undefined ? null : value
  }
  return result
}

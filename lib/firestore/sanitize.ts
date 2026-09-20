// Firestore's setDoc/updateDoc throw (not silently drop) on any field
// whose value is literally `undefined` — easy to produce from "empty
// optional field" form state like `phone || undefined`. This exact bug
// has shown up independently in three different write paths
// (Application updates, Contact updates, Profile saves); centralizing
// the fix here so the next one gets it for free instead of repeating it.
//
// Recursive: Resume nests arrays of objects (ExperienceEntry, ProjectEntry,
// etc.) that can carry the same "empty optional field" undefined values a
// level or two deep. A shallow sanitizer would pass those arrays through
// unchanged and reproduce the bug in a new shape the first time a nested
// entry has a blank optional field.
function sanitizeValue(value: unknown): unknown {
  if (value === "" || value === undefined) return null
  if (Array.isArray(value)) return value.map(sanitizeValue)
  if (value !== null && typeof value === "object" && value.constructor === Object) {
    return sanitizeForFirestore(value as Record<string, unknown>)
  }
  return value
}

export function sanitizeForFirestore<T extends Record<string, unknown>>(obj: T): T {
  const result = {} as T
  for (const [key, value] of Object.entries(obj)) {
    ;(result as Record<string, unknown>)[key] = sanitizeValue(value)
  }
  return result
}

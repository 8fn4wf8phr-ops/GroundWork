// The agent routes reject over-long fields outright (rather than silently
// truncating server-side), so callers holding third-party text — job
// titles, descriptions — trim it to the route's limit first.
export function clip(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) : text
}

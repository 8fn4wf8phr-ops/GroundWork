// Every source API returns descriptions as raw HTML. None of it is ever
// rendered as HTML in this app (no dangerouslySetInnerHTML) — stripped to
// plain text here so it's safe to display and usable for keyword matching.
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim()
}

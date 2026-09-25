const HAS_SHEET = /<section\b[^>]*\bdata-notebook-sheet\b/i
const LEGACY_BREAK =
  /<div\b[^>]*\bdata-notebook-page-break\s*=\s*["']true["'][^>]*>\s*<\/div>/gi

/**
 * Ensures notebook HTML uses `<section data-notebook-sheet>` pages.
 * Migrates legacy inline page-break divs into separate sections.
 */
export function migrateNotebookHtmlToSheets(html: string): string {
  const trimmed = html.trim()
  if (!trimmed) {
    return '<section data-notebook-sheet="true"><p></p></section>'
  }
  if (HAS_SHEET.test(trimmed)) {
    return trimmed
  }
  LEGACY_BREAK.lastIndex = 0
  if (!LEGACY_BREAK.test(trimmed)) {
    return `<section data-notebook-sheet="true">${trimmed}</section>`
  }
  LEGACY_BREAK.lastIndex = 0
  const parts: string[] = []
  let last = 0
  let m: RegExpExecArray | null
  while ((m = LEGACY_BREAK.exec(trimmed)) !== null) {
    parts.push(trimmed.slice(last, m.index))
    last = m.index + m[0].length
  }
  parts.push(trimmed.slice(last))
  return parts
    .map((chunk) => chunk.trim() || "<p></p>")
    .map((inner) => `<section data-notebook-sheet="true">${inner}</section>`)
    .join("")
}

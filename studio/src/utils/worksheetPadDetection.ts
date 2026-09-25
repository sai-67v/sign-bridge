import type { IPad, PadMediumType } from "../services/pads"
import { getPadMediumType } from "../services/pads"
import { isWorksheetContent } from "./WorksheetParser"

/**
 * Minimal pad/note shape for worksheet detection (IPad, Note, or list tiles).
 */
export type WorksheetDetectablePad = {
  padType?: string | null
  worksheetSections?: { length: number } | null | undefined
}

/**
 * True when the pad should behave as a worksheet in chrome, routing, and shell
 * (pad type, legacy sections, or body marker).
 */
export function isWorksheetPad(
  pad: WorksheetDetectablePad | null | undefined,
  content: string
): boolean {
  if (pad?.padType === "worksheet") return true
  const sections = pad?.worksheetSections
  if (sections && typeof sections.length === "number" && sections.length > 0) return true
  return isWorksheetContent(content ?? "")
}

/**
 * True when the editor should mount {@link WorksheetViewer} instead of TipTap
 * (marker-based or legacy sections).
 */
export function shouldRenderWorksheetBody(
  content: string,
  legacySections: { length: number } | null | undefined
): boolean {
  return isWorksheetContent(content ?? "") || !!(legacySections && legacySections.length > 0)
}

/**
 * Library / home tile medium type: treats marker-only or legacy worksheets as worksheets.
 */
export function getPadMediumTypeWithBody(
  p: Pick<IPad, "mediumType" | "padType" | "notebookId" | "worksheetSections" | "content">
): PadMediumType {
  if (isWorksheetPad(p, p.content ?? "")) return "worksheet"
  return getPadMediumType(p)
}

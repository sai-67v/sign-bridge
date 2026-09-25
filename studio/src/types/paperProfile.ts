/**
 * Paper / pen UI model — aligned with specs/002-paper-pens-materials/contracts/paper-profile.schema.json
 * Persisted on the `notes` document as JSON strings in Appwrite.
 */

export type PaperTemplateId =
  | "blank"
  | "ruled"
  | "grid"
  | "dot"

export type PaperSizeClass =
  | "sticky"
  | "a6"
  | "a5"
  | "a4"
  | "whiteboard"

export type TypingMode = "structured_flow" | "free_placement"
export type MediumType = "page" | "notebook" | "worksheet" | "flashcard"
export const ACTIVE_MEDIUM_TYPES: ReadonlyArray<MediumType> = ["page"]
export const DEFERRED_MEDIUM_TYPES: ReadonlyArray<MediumType> = ["worksheet", "flashcard"]

export type PaperBinding = {
  type: "none" | "notebook"
  notebookId?: string
}

export type PaperOverlay = {
  kind: "none" | "sticky"
  parentNoteId?: string
}

export type PaperProfile = {
  templateId: PaperTemplateId
  sizeClass: PaperSizeClass
  binding?: PaperBinding
  overlay?: PaperOverlay
  typingMode: TypingMode
  assistsEnabled?: boolean
}

export type PenModality = "pencil" | "pen" | "marker" | "eraser" | "dot"

export type InkPoint = {
  x: number
  y: number
  t: number
}

export type InkStroke = {
  id: string
  modality: Exclude<PenModality, "eraser">
  color: string
  width: number
  points: InkPoint[]
}

export type InkSnapshot = {
  version: 1
  strokes: InkStroke[]
}

export const DEFAULT_PAPER_PROFILE: PaperProfile = {
  templateId: "ruled",
  sizeClass: "a4",
  typingMode: "structured_flow",
  assistsEnabled: true,
}

export const EMPTY_INK_SNAPSHOT: InkSnapshot = {
  version: 1,
  strokes: [],
}

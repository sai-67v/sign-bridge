import {
  DEFAULT_PAPER_PROFILE,
  type PaperSizeClass,
  type PaperTemplateId,
  type TypingMode,
} from "../types/paperProfile"

export type PaperTemplateDef = {
  id: PaperTemplateId
  label: string
  typingMode: TypingMode
  /** Matches [data-paper-template] in CSS */
  cssToken: PaperTemplateId
}

export const PAPER_TEMPLATES: readonly PaperTemplateDef[] = [
  { id: "blank", label: "Blank", typingMode: "free_placement", cssToken: "blank" },
  { id: "ruled", label: "Ruled", typingMode: "structured_flow", cssToken: "ruled" },
  { id: "grid", label: "Grid", typingMode: "structured_flow", cssToken: "grid" },
  { id: "dot", label: "Dots", typingMode: "free_placement", cssToken: "dot" },
]

/** Maps removed / unknown stored ids to a supported template */
export function normalizeTemplateId(raw: unknown): PaperTemplateId {
  const id = typeof raw === "string" ? raw.trim() : ""
  if (id === "checklist") return "ruled"
  const hit = PAPER_TEMPLATES.find((t) => t.id === id)
  return hit?.id ?? DEFAULT_PAPER_PROFILE.templateId
}

export const PAPER_SIZE_OPTIONS: {
  id: PaperSizeClass
  label: string
}[] = [
  { id: "sticky", label: "Sticky" },
  { id: "a6", label: "A6 / card" },
  { id: "a5", label: "A5" },
  { id: "a4", label: "A4" },
  { id: "whiteboard", label: "Board" },
]

export function getTemplateDef(id: PaperTemplateId): PaperTemplateDef {
  return PAPER_TEMPLATES.find((t) => t.id === id) ?? PAPER_TEMPLATES[0]
}

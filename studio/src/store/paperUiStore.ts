import { create } from "zustand"
import { normalizeTemplateId } from "../constants/paperTemplates"
import type { MediumType, PaperProfile, PaperSizeClass, PaperTemplateId, PenModality } from "../types/paperProfile"

export const PAPER_UI_PEN_COLORS = ["#171717", "#2563eb", "#dc2626", "#15803d"] as const

/** Draw = bottom pen pill (tablet / Goodnotes-style). Type = top text tools (desktop / Notion-style). */
export type PaperChromePanel = "draw" | "type" | null

export type PaperUiState = {
  activeTemplateId: PaperTemplateId
  activeSizeClass: PaperSizeClass
  penModality: PenModality
  penColorIndex: number
  penWidthIndex: number
  /** When true, draw/type panels are mutually exclusive (one always active). */
  dualChromeEnabled: boolean
  /** Active chrome strip in dual mode; ignored when dual mode is off — kept in memory so returning from worksheet restores draw vs type. */
  expandedChromePanel: PaperChromePanel
  availableMediums: ReadonlyArray<MediumType>
  hydrateFromProfile: (profile: PaperProfile | null | undefined) => void
  setTemplate: (id: PaperTemplateId) => void
  setSizeClass: (s: PaperSizeClass) => void
  setPenModality: (m: PenModality) => void
  cyclePenColor: () => void
  cyclePenWidth: () => void
  setDualChromeEnabled: (enabled: boolean) => void
  setExpandedChromePanel: (panel: PaperChromePanel) => void
  openDrawPanel: () => void
  openTypePanel: () => void
}

export const usePaperUiStore = create<PaperUiState>((set) => ({
  activeTemplateId: "ruled",
  activeSizeClass: "a4",
  penModality: "pen",
  penColorIndex: 0,
  penWidthIndex: 1,
  dualChromeEnabled: false,
  expandedChromePanel: "type",
  availableMediums: ["page", "notebook", "worksheet", "flashcard"],
  hydrateFromProfile: (profile) => {
    if (!profile) return
    set({
      activeTemplateId: normalizeTemplateId(profile.templateId),
      activeSizeClass: profile.sizeClass,
    })
  },
  setTemplate: (id) => set({ activeTemplateId: id }),
  setSizeClass: (activeSizeClass) => set({ activeSizeClass }),
  setPenModality: (penModality) => set({ penModality }),
  cyclePenColor: () =>
    set((s) => ({ penColorIndex: (s.penColorIndex + 1) % PAPER_UI_PEN_COLORS.length })),
  cyclePenWidth: () => set((s) => ({ penWidthIndex: (s.penWidthIndex + 1) % 3 })),
  setDualChromeEnabled: (dualChromeEnabled) => {
    set((s) => {
      if (dualChromeEnabled === s.dualChromeEnabled) return s
      if (!dualChromeEnabled) {
        // Keep expandedChromePanel so navigating worksheet → regular note restores draw/type choice.
        // ToolsDock when !dual uses only dualChrome; TypewriterDock/ToolsDock both gate on dual for mutual exclusivity.
        return { dualChromeEnabled: false }
      }
      const panel =
        s.expandedChromePanel === "draw" || s.expandedChromePanel === "type"
          ? s.expandedChromePanel
          : "type"
      return { dualChromeEnabled: true, expandedChromePanel: panel }
    })
  },
  setExpandedChromePanel: (expandedChromePanel) => set({ expandedChromePanel }),
  openDrawPanel: () => set({ expandedChromePanel: "draw" }),
  openTypePanel: () => set({ expandedChromePanel: "type" }),
}))

export function paperUiPenColor(): string {
  const i = usePaperUiStore.getState().penColorIndex
  return PAPER_UI_PEN_COLORS[i] ?? PAPER_UI_PEN_COLORS[0]
}

export function paperUiPenWidths(): [number, number, number] {
  return [1.25, 2, 4]
}

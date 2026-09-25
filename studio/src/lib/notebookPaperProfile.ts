import { getTemplateDef, normalizeTemplateId } from "../constants/paperTemplates"
import {
  DEFAULT_PAPER_PROFILE,
  type PaperProfile,
  type PaperSizeClass,
  type PaperTemplateId,
} from "../types/paperProfile"

export type PaperProfileCarrier = {
  paperProfile?: PaperProfile | null
}

/**
 * Canonical paper settings for an open notebook: first page wins, merged with defaults.
 */
export function resolveNotebookCanonicalPaperProfile(pages: readonly PaperProfileCarrier[]): PaperProfile {
  const overlay = pages[0]?.paperProfile ?? undefined
  const normalizedTemplateId = normalizeTemplateId(overlay?.templateId ?? DEFAULT_PAPER_PROFILE.templateId)
  const def = getTemplateDef(normalizedTemplateId)
  return {
    ...DEFAULT_PAPER_PROFILE,
    ...overlay,
    templateId: normalizedTemplateId,
    sizeClass: overlay?.sizeClass ?? DEFAULT_PAPER_PROFILE.sizeClass,
    typingMode: overlay?.typingMode ?? def.typingMode,
    assistsEnabled: overlay?.assistsEnabled ?? DEFAULT_PAPER_PROFILE.assistsEnabled,
  }
}

/** Same shaping as PaperSheet activeProfile merge (store drives template/size/typing flow). */
export function buildPaperProfileFromUiState(
  basePartial: Partial<PaperProfile> | null | undefined,
  activeTemplateId: PaperTemplateId,
  activeSizeClass: PaperSizeClass
): PaperProfile {
  const def = getTemplateDef(activeTemplateId)
  const baseLayer = basePartial ?? {}
  return {
    ...DEFAULT_PAPER_PROFILE,
    ...baseLayer,
    templateId: activeTemplateId,
    sizeClass: activeSizeClass,
    typingMode: def.typingMode,
    assistsEnabled: baseLayer.assistsEnabled ?? true,
  }
}

/** Compare persisted profile fields to avoid redundant batch updates. */
export function paperProfilePersistenceEquals(a: PaperProfile, b: PaperProfile): boolean {
  return (
    a.templateId === b.templateId &&
    a.sizeClass === b.sizeClass &&
    a.typingMode === b.typingMode &&
    (a.assistsEnabled ?? true) === (b.assistsEnabled ?? true)
  )
}

/** True when every page already matches the target profile (for no-op batch writes). */
export function allPagesMatchPaperProfile(pages: readonly PaperProfileCarrier[], target: PaperProfile): boolean {
  if (pages.length === 0) return false
  return pages.every((p) => {
    const existing = p.paperProfile
    if (!existing) return false
    return paperProfilePersistenceEquals(existing, target)
  })
}

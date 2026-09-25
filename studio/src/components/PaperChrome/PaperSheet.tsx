import type { ReactNode } from "react"
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { usePaperUiStore } from "../../store/paperUiStore"
import { buildPaperProfileFromUiState } from "../../lib/notebookPaperProfile"
import { updatePadPaperProfile } from "../../services/pads"
import type { PaperProfile } from "../../types/paperProfile"
/**
 * Frames the editor as a paper sheet: template/size live in the left nav;
 * body is the layered “paper” card. With dualEditorChrome, draw vs type toolbars
 * are mutually exclusive; switch with the controls on each bar.
 */
type Props = {
  noteId: string
  paperProfile?: PaperProfile | null
  mediumType?: "page" | "notebook" | "worksheet" | "flashcard"
  notebookTitle?: string | null
  onNotebookTitleCommit?: (title: string) => void
  settingsSlot?: ReactNode
  /** Floated beside the notebook card (outside the sheet), bottom-left desk margin. */
  notebookFloatingSlot?: ReactNode
  children: ReactNode
  /** When false, only the bottom pen dock shows (no draw/type latch). Worksheets use true so teachers can switch modes. */
  dualEditorChrome?: boolean
  /** Hide the per-page settings slot — used for stacked notebook pages. */
  hideSettingsChrome?: boolean
  /** Hide the spiral binding rings (e.g. print/special layouts). */
  hideNotebookBinding?: boolean
  /** Notebook stack: parent hydrates `usePaperUiStore` once; skip per-sheet hydration. */
  suppressProfileHydrate?: boolean
  /** Notebook stack: parent batch-persists profile; skip per-note `updatePadPaperProfile`. */
  suppressProfilePersistence?: boolean
}

export default function PaperSheet({
  noteId,
  paperProfile,
  mediumType = "page",
  notebookTitle = null,
  onNotebookTitleCommit,
  settingsSlot,
  notebookFloatingSlot,
  children,
  dualEditorChrome = true,
  hideSettingsChrome = false,
  hideNotebookBinding = false,
  suppressProfileHydrate = false,
  suppressProfilePersistence = false,
}: Props) {
  const activeTemplateId = usePaperUiStore((s) => s.activeTemplateId)
  const activeSizeClass = usePaperUiStore((s) => s.activeSizeClass)
  const hydrateFromProfile = usePaperUiStore((s) => s.hydrateFromProfile)
  const setDualChromeEnabled = usePaperUiStore((s) => s.setDualChromeEnabled)
  const firstPersistSkipped = useRef(false)
  const titleInputRef = useRef<HTMLInputElement | null>(null)
  const bodyRef = useRef<HTMLDivElement | null>(null)
  const [springRingCount, setSpringRingCount] = useState(18)
  const [titleDraft, setTitleDraft] = useState(
    () => (notebookTitle ?? "").trim() || "Untitled"
  )

  useLayoutEffect(() => {
    if (mediumType !== "notebook" || hideNotebookBinding) return
    const el = bodyRef.current
    if (!el) return

    const measureLineStepPx = () => {
      const raw = getComputedStyle(el).getPropertyValue("--paper-line-step").trim() || "1.5rem"
      const probe = document.createElement("div")
      probe.style.cssText =
        "position:absolute;visibility:hidden;width:0;pointer-events:none;box-sizing:border-box;height:" +
        raw
      el.appendChild(probe)
      const h = probe.offsetHeight
      el.removeChild(probe)
      return h > 0 ? h : 24
    }

    const remPx = () => parseFloat(getComputedStyle(document.documentElement).fontSize) || 16

    const updateRingCount = () => {
      const lineStepPx = measureLineStepPx()
      const inner = Math.max(0, el.clientHeight - 2 * remPx())
      const next = Math.max(10, Math.min(120, Math.round(inner / lineStepPx)))
      setSpringRingCount((prev) => (prev === next ? prev : next))
    }

    updateRingCount()
    const ro = new ResizeObserver(() => updateRingCount())
    ro.observe(el)
    return () => ro.disconnect()
  }, [hideNotebookBinding, mediumType, noteId])

  useEffect(() => {
    setTitleDraft((notebookTitle ?? "").trim() || "Untitled")
  }, [noteId])

  useEffect(() => {
    if (document.activeElement === titleInputRef.current) return
    setTitleDraft((notebookTitle ?? "").trim() || "Untitled")
  }, [notebookTitle])

  useEffect(() => {
    if (suppressProfileHydrate) return
    hydrateFromProfile(paperProfile)
  }, [hydrateFromProfile, paperProfile, suppressProfileHydrate])

  useEffect(() => {
    setDualChromeEnabled(dualEditorChrome)
  }, [dualEditorChrome, setDualChromeEnabled])

  const persistProfileCandidate = useMemo<PaperProfile | null>(() => {
    if (suppressProfilePersistence) return null
    return buildPaperProfileFromUiState(paperProfile, activeTemplateId, activeSizeClass)
  }, [suppressProfilePersistence, activeSizeClass, activeTemplateId, paperProfile])

  useEffect(() => {
    if (suppressProfilePersistence) return
    if (!persistProfileCandidate) return
    if (!firstPersistSkipped.current) {
      firstPersistSkipped.current = true
      if (paperProfile) return
    }
    const t = window.setTimeout(() => {
      updatePadPaperProfile(noteId, persistProfileCandidate).catch((error) => {
        console.error("Failed to persist paper profile", error)
      })
    }, 350)
    return () => window.clearTimeout(t)
  }, [persistProfileCandidate, noteId, paperProfile, suppressProfilePersistence])

  const titleField =
    notebookTitle != null ? (
      <input
        ref={titleInputRef}
        type="text"
        autoComplete="off"
        className={
          mediumType === "page" || mediumType === "worksheet"
            ? "paper-sheet__cover-title paper-sheet__page-title-input"
            : "paper-sheet__cover-title"
        }
        aria-label={
          mediumType === "notebook"
            ? "Notebook title"
            : mediumType === "worksheet"
              ? "Worksheet title"
              : "Page title"
        }
        value={titleDraft}
        spellCheck={false}
        onMouseDown={(event) => event.stopPropagation()}
        onChange={(event) => setTitleDraft(event.currentTarget.value)}
        onBlur={(event) => {
          const next = event.currentTarget.value.trim() || "Untitled"
          setTitleDraft(next)
          onNotebookTitleCommit?.(next)
        }}
        onKeyDown={(event) => {
          event.stopPropagation()
          if (event.key === "Enter") {
            event.preventDefault()
            event.currentTarget.blur()
          }
        }}
      />
    ) : null

  return (
    <div className={`paper-sheet paper-sheet--minimal ${mediumType === "notebook" ? "paper-sheet--notebook" : "paper-sheet--page"}`}>
      {mediumType === "notebook" ? notebookFloatingSlot : null}
      <div
        ref={bodyRef}
        className="paper-sheet__body"
        data-paper-template={activeTemplateId}
        data-paper-size={activeSizeClass}
        data-medium-type={mediumType}
      >
        {mediumType === "notebook" && !hideNotebookBinding ? (
          <div className="paper-sheet__spring" aria-hidden>
            {Array.from({ length: springRingCount }).map((_, idx) => (
              <span key={idx} className="paper-sheet__spring-ring" />
            ))}
          </div>
        ) : null}
        {titleField ? (
          mediumType === "page" || mediumType === "worksheet" ? (
            <div className="paper-sheet__page-title-strip">{titleField}</div>
          ) : (
            titleField
          )
        ) : null}
        {!hideSettingsChrome && settingsSlot ? (
          <div className="paper-sheet__settings">{settingsSlot}</div>
        ) : null}
        {children}
      </div>
    </div>
  )
}

import type { Editor } from "@tiptap/react"
import { HiOutlinePencilAlt } from "react-icons/hi"
import { createPortal } from "react-dom"
import { useParams } from "react-router-dom"
import { TypingToolbar } from "../PadEditor/TypingToolbar"
import { useNotebookStackStore } from "../../store/notebookStackStore"
import { usePadEditorStore } from "../../store/padEditorStore"
import { usePaperUiStore } from "../../store/paperUiStore"
import { useNoteStore } from "../../store/noteStore"
import { isWorksheetPad } from "../../utils/worksheetPadDetection"

function pickLiveEditor(ed: Editor | undefined | null): Editor | null {
  if (!ed || ed.isDestroyed) return null
  return ed
}

/** Prefer focused pad, then route pad, then any live editor in the notebook stack (destroyed instances skipped). */
function resolveRibbonEditor(
  byId: Record<string, Editor>,
  focusedTypingPadId: string | null,
  fallbackId: string | undefined,
  stackIds: readonly string[]
): Editor | null {
  const tryId = (id: string | undefined) => pickLiveEditor(id ? byId[id] : undefined)

  const orderedCandidates: string[] = []
  const push = (id: string | undefined) => {
    if (id && !orderedCandidates.includes(id)) orderedCandidates.push(id)
  }
  push(focusedTypingPadId ?? undefined)
  push(fallbackId)
  for (const sid of stackIds) push(sid)

  for (const cid of orderedCandidates) {
    const e = tryId(cid)
    if (e) return e
  }
  return null
}

type TypewriterDockProps = {
  /** Active route pad id (preferred — matches TipTap registration key). */
  noteId?: string
}

/**
 * Top-center “Notion-style” formatting pill. In dual mode, use the pencil control to switch to drawing.
 * Do not auto-focus the TipTap editor from here — repeated focus() fights toolbar clicks (buttons never receive properly).
 */
export function TypewriterDock({ noteId: noteIdProp }: TypewriterDockProps = {}) {
  const { id: routeNoteId } = useParams()
  const noteId = noteIdProp ?? routeNoteId
  /** Subscribe to the whole map so we always re-render when any editor registers (TipTap can lag one phase). */
  const editorsById = usePadEditorStore((s) => s.byId)
  const focusedTypingPadId = usePadEditorStore((s) => s.focusedTypingPadId)
  const orderedPageIds = useNotebookStackStore((s) => s.orderedPageIds)
  const fallbackId = noteId ?? routeNoteId
  const editor = resolveRibbonEditor(
    editorsById,
    focusedTypingPadId,
    fallbackId,
    orderedPageIds
  )
  const expanded = usePaperUiStore((s) => s.expandedChromePanel)
  const dual = usePaperUiStore((s) => s.dualChromeEnabled)
  const openDrawPanel = usePaperUiStore((s) => s.openDrawPanel)
  const currentNote = useNoteStore((s) => s.currentNote)
  const worksheetSurface =
    !!noteId &&
    currentNote?.id === noteId &&
    isWorksheetPad(
      {
        padType: currentNote.padType ?? undefined,
        worksheetSections: currentNote.worksheetSections,
      },
      currentNote.content ?? ""
    )

  const visible = dual && expanded === "type"

  if (!visible) return null

  /** Structured worksheets: full TypingToolbar while a question (task) editor is focused; hint otherwise. */
  if (worksheetSurface && noteId) {
    const taskFocusId =
      focusedTypingPadId && focusedTypingPadId.startsWith(`${noteId}__wsTask__`)
        ? focusedTypingPadId
        : null
    const taskEditor = taskFocusId ? pickLiveEditor(editorsById[taskFocusId]) : null
    const dock = (
      <div
        className={`typewriter-dock${taskEditor ? "" : " typewriter-dock--worksheet"}`}
        role="toolbar"
        aria-label={taskEditor ? "Text formatting" : "Worksheet editing"}
      >
        {taskEditor ? (
          <TypingToolbar editor={taskEditor} className="typewriter-dock__tools" />
        ) : (
          <span className="typewriter-dock__worksheet-hint text-xs opacity-80 px-2 py-1 shrink min-w-0">
            Click a question to edit with the same text tools as a normal page. Use the pencil when you need ink.
          </span>
        )}
        <button
          type="button"
          className="chrome-dock__mode-switch"
          title="Switch to drawing tools"
          aria-label="Switch to drawing tools"
          onClick={() => openDrawPanel()}
        >
          <HiOutlinePencilAlt className="h-4 w-4" aria-hidden />
        </button>
      </div>
    )
    if (typeof document === "undefined") return null
    return createPortal(dock, document.body)
  }

  const dock = (
    <div className="typewriter-dock" role="toolbar" aria-label="Text formatting">
      {editor ? (
        <TypingToolbar editor={editor} className="typewriter-dock__tools" />
      ) : (
        <span
          className="typewriter-dock__tools text-xs opacity-70 px-3 py-1 shrink-0 tabular-nums"
          aria-live="polite"
        >
          Loading tools…
        </span>
      )}
      <button
        type="button"
        className="chrome-dock__mode-switch"
        title="Switch to drawing tools"
        aria-label="Switch to drawing tools"
        onClick={() => openDrawPanel()}
      >
        <HiOutlinePencilAlt className="h-4 w-4" aria-hidden />
      </button>
    </div>
  )

  if (typeof document === "undefined") return null

  return createPortal(dock, document.body)
}

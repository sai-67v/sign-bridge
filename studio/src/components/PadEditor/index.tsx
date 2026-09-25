import { useEditor, EditorContent } from "@tiptap/react"
import MarkdownIt from "markdown-it"
import StarterKit from "@tiptap/starter-kit"
import Highlight from "@tiptap/extension-highlight"
import Typography from "@tiptap/extension-typography"
import TaskList from "@tiptap/extension-task-list"
import TaskItem from "@tiptap/extension-task-item"
import OrderedList from "@tiptap/extension-ordered-list"
import Table from "@tiptap/extension-table"
import TableHeader from "@tiptap/extension-table-header"
import TableRow from "@tiptap/extension-table-row"
import TableCell from "@tiptap/extension-table-cell"
import TiptapHeading from "@tiptap/extension-heading"
import CharacterCount from "@tiptap/extension-character-count"
import Image from "@tiptap/extension-image"
import Link from "@tiptap/extension-link"
import Youtube from "@tiptap/extension-youtube"
import Placeholder from "@tiptap/extension-placeholder"
import Underline from "@tiptap/extension-underline"
import TextAlign from "@tiptap/extension-text-align"
import { lowlight } from "lowlight"

import ControlBar from "./ControlBar"
import { IPad, updatePad } from "../../services/pads"
import { registerPendingPadSaveFlush } from "../../services/pendingPadSaveFlush"
import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from "react"
import { shortCutAction } from "../Shortcut/ShortcutAction"
import ErrorCapture from "../ErrorCapture"
import PadInfo from "./PadInfo"
import { cn } from "@/lib/utils"

import PadDropZone from "./PadDropZone"
import ContextMenu from "../ContextMenu"
import { TableActions } from "./TableActions"
import { useOutlineStore } from "../../store/outlines"
import { pressed } from "../Shortcut/Shortcut"
import { guidGenerator } from "../../libs/utils"
import { encryptText } from "../../services/encryption"
// language
import { mermaid } from "../../extensions/CustomCodeBlock/language"
import { CustomCodeBlock } from "../../extensions/CustomCodeBlock"
import { BlockquoteSourceAttrs } from "../../extensions/BlockquoteSourceAttrs"
import { useSettingStore } from "../../store/settings"
import { UploadingImage } from "../../extensions/UploadingImage"
import { useAuth } from "../../hooks/useAuth"
import { ALL_USERS_CAN_EDIT, Rules } from "../../containers/PadActions/PadShareModal/types"
import { useNoteStore } from "../../store/noteStore"
import { useWorksheetStore } from "../../store/worksheetStore"
import WorksheetViewer from "../WorksheetViewer"
import { shouldRenderWorksheetBody } from "../../utils/worksheetPadDetection"
import { usePadEditorStore } from "../../store/padEditorStore"
import { usePaperUiStore } from "../../store/paperUiStore"
import { USE_APPWRITE } from "../../services/api"
import { getTemplateDef } from "../../constants/paperTemplates"
import { PaperInkLayer } from "../PaperChrome/PaperInkLayer"
import { NotebookDocument } from "../../extensions/NotebookDocument"
import { NotebookSheet } from "../../extensions/NotebookSheet"
import { migrateNotebookHtmlToSheets } from "../../lib/migrateNotebookHtmlToSheets"


interface IPadEditorProp {
  id: string
  content: string
  data: IPad
}

const HighlightConfigure = Highlight.configure({
  multicolor: true,
})

const TaskListConfigure = TaskList.configure({
  HTMLAttributes: {
    class: "task-list",
  },
})

const limit = 20000
const CharacterCountConfigure = CharacterCount.configure({
  limit,
})

const CustomTableCell = TableCell.extend({
  addAttributes() {
    return {
      // extend the existing attributes …
      ...this.parent?.(),

      // and add a new one …
      backgroundColor: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-background-color"),
        renderHTML: (attributes) => {
          return {
            "data-background-color": attributes.backgroundColor,
            style: `background-color: ${attributes.backgroundColor}`,
          }
        },
      },
    }
  },
})

const Heading = TiptapHeading.extend({
  addGlobalAttributes() {
    return [
      {
        // Extend the following extensions
        types: ["heading"],
        // … with those attributes
        attributes: {
          id: {
            renderHTML: () => ({
              id: guidGenerator(),
            }),
          },
        },
      },
    ]
  },
})

const CustomOrderedList = OrderedList.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      listType: {
        default: "decimal",
        parseHTML: (element) => element.getAttribute("data-list-type"),
        renderHTML: (attributes) => {
          return {
            "data-list-type": attributes.listType,
          }
        },
      },
    }
  },
})

lowlight.registerLanguage("mermaid", mermaid)

const extensions = [
  NotebookDocument,
  NotebookSheet,
  StarterKit.configure({
    document: false,
    codeBlock: false,
    heading: false,
    orderedList: false,
    /** UploadingImage is Paragraph.extend — must not duplicate StarterKit's paragraph */
    paragraph: false,
  }),
  TaskListConfigure,
  TaskItem.configure({
    nested: true,
  }),
  Table.configure({
    resizable: true,
  }),
  TableRow,
  TableHeader,
  Heading,
  CustomOrderedList,
  CustomTableCell,
  HighlightConfigure,
  Typography,
  CharacterCountConfigure,
  Image,
  Link.configure({
    openOnClick: false,
  }),
  BlockquoteSourceAttrs,
  Underline,
  TextAlign.configure({
    types: ["heading", "paragraph"],
  }),
  CustomCodeBlock.configure({
    // @ts-ignore
    lowlight,
  }),
  Youtube.configure({}),
  UploadingImage,
  Placeholder.configure({
    placeholder: ({ node }) => {
      if (node.type.name === "heading") return "Heading"
      return "Start writing, or press '/' for commands…"
    },
    showOnlyCurrent: true,
    /** Walk into `notebookSheet` so empty paragraphs get `is-empty` + placeholder (not only the wrapper). */
    includeChildren: true,
  }),
]

const md = new MarkdownIt({ html: true })

export default function PadEditor({ id, content, data }: IPadEditorProp) {
  const registerPadEditor = usePadEditorStore((s) => s.registerPadEditor)
  const setFocusedTypingPadId = usePadEditorStore((s) => s.setFocusedTypingPadId)
  const { documentZoom } = useSettingStore()
  const { setOutlines } = useOutlineStore()
  const { user } = useAuth()
  const { updateLocalContent } = useNoteStore()
  const activeTemplateId = usePaperUiStore((s) => s.activeTemplateId)
  const expandedChromePanel = usePaperUiStore((s) => s.expandedChromePanel)
  const dualChromeEnabled = usePaperUiStore((s) => s.dualChromeEnabled)
  const textModeActive = dualChromeEnabled && expandedChromePanel === "type"
  const padProseClass =
    getTemplateDef(activeTemplateId).typingMode === "structured_flow"
      ? "pad-prose--structured"
      : "pad-prose--free"

  // Legacy support: check for old worksheetSections format
  const { getWorksheetSections } = useWorksheetStore();
  const legacySections = data.worksheetSections || getWorksheetSections(id);

  /** Worksheet surface: marker in body and/or legacy sections (see worksheetPadDetection). */
  const showWorksheetViewer = shouldRenderWorksheetBody(content, legacySections);

  // Local content state for worksheets so that task edits from onContentChange
  // are reflected immediately without waiting for a parent re-fetch from the server
  const [worksheetContent, setWorksheetContent] = useState(content);
  useEffect(() => {
    setWorksheetContent(content);
  }, [content]);

  const initialContent = useState(() => {
    // DON'T process worksheet content through markdown-it - keep it raw
    if (showWorksheetViewer) {
      return ''; // Empty - we won't use the editor for worksheets
    }
    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return migrateNotebookHtmlToSheets("")
    }
    const isHTML = /^\s*<(p|h[1-6]|div|ul|ol|li|table|blockquote|pre|img|br|span|section)/i.test(
      content
    )
    if (!isHTML) {
      try {
        return migrateNotebookHtmlToSheets(md.render(content))
      } catch (e) {
        console.error("Failed to parse initial markdown content", e)
      }
    }
    return migrateNotebookHtmlToSheets(content)
  })[0]

  /**
   * Latest unsaved HTML for flush-on-unmount / beforeunload (ref avoids effect running every keystroke,
   * which previously cleared the debounce timer and saved stale content).
   */
  const pendingSaveRef = useRef<{ id: string; html: string } | null>(null)
  /** Per-instance debounce — avoids cross-editor save races when multiple tabs mount. */
  /** DOM timers are `number`; Node typings use `Timeout` — use `number` for `window.setTimeout`. */
  /** ED contract (specs/006-pad-core-cleanup/contracts/pad-editor-reliability.md):
   *  ED-01/06: debounced save via onUpdate → updatePad; ED-03: pad switches via route id + EditorContent key.
   *  ED-02: focus handlers below; ED-04: worksheet branch skips this editor path; ED-05: scroll container pad-editor-scroll.
   */
  const saveDebounceRef = useRef<number | null>(null)

  // Only create editor for non-worksheet content
  const editor = useEditor(
    {
      extensions: extensions,
      content: initialContent,
      editable: !showWorksheetViewer, // Disable editing for worksheets
      onUpdate: ({ editor }) => {
        // Skip auto-save for worksheets - WorksheetViewer handles its own saves
        if (showWorksheetViewer) return;

        setOutlines()
        const html = editor.getHTML()
        const cipherContent = encryptText(html)

        // Update local store immediately for AI context
        updateLocalContent(id, html)

        pendingSaveRef.current = { id, html }

        if (saveDebounceRef.current) {
          window.clearTimeout(saveDebounceRef.current)
          saveDebounceRef.current = null
        }

        saveDebounceRef.current = window.setTimeout(() => {
          saveDebounceRef.current = null
          void updatePad({ id, content: html, cipherContent })
            .then(() => {
              if (pendingSaveRef.current?.id === id && pendingSaveRef.current?.html === html) {
                pendingSaveRef.current = null
              }
            })
            .catch((err) => {
              console.error("Failed to save note content", id, err)
            })
        }, 600)
      },
    },
    [id, showWorksheetViewer]
  )

  useLayoutEffect(() => {
    if (!editor) return
    registerPadEditor(id, editor)
    return () => {
      const prevEditor = editor
      queueMicrotask(() => {
        const cur = usePadEditorStore.getState().byId[id]
        if (cur === prevEditor) {
          registerPadEditor(id, null)
        }
      })
    }
  }, [editor, id, registerPadEditor])

  useEffect(() => {
    if (!editor) return
    const onDestroy = () => {
      const cur = usePadEditorStore.getState().byId[id]
      if (cur === editor) registerPadEditor(id, null)
    }
    editor.on("destroy", onDestroy)
    return () => {
      editor.off("destroy", onDestroy)
    }
  }, [editor, id, registerPadEditor])

  useEffect(() => {
    if (!editor || showWorksheetViewer) return
    const onFocus = () => setFocusedTypingPadId(id)
    editor.on("focus", onFocus)
    if (editor.isFocused) onFocus()
    return () => {
      editor.off("focus", onFocus)
    }
  }, [editor, id, showWorksheetViewer, setFocusedTypingPadId])

  // FastAPI: beforeunload keepalive PATCH. Appwrite: debounced `updatePad` + flush on unmount and before in-app navigations (sidebar Home, etc.).
  useEffect(() => {
    if (showWorksheetViewer) return undefined

    const flush = async () => {
      if (saveDebounceRef.current) {
        window.clearTimeout(saveDebounceRef.current)
        saveDebounceRef.current = null
      }
      const pending = pendingSaveRef.current
      if (!pending) return
      try {
        await updatePad({
          id: pending.id,
          content: pending.html,
          cipherContent: encryptText(pending.html),
        })
        if (pendingSaveRef.current?.id === pending.id && pendingSaveRef.current?.html === pending.html) {
          pendingSaveRef.current = null
        }
      } catch (err) {
        console.error("Failed to flush note save", pending.id, err)
      }
    }

    const unregister = registerPendingPadSaveFlush(id, () => flush())

    const saveOnUnload = () => {
      if (USE_APPWRITE) return
      const pending = pendingSaveRef.current
      if (!pending) return
      const url = `${import.meta.env?.VITE_CANISCLI_URL || "http://localhost:5001"}/api/notes/${pending.id}`
      void fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: pending.html }),
        keepalive: true,
      })
    }

    window.addEventListener("beforeunload", saveOnUnload)

    return () => {
      unregister()
      window.removeEventListener("beforeunload", saveOnUnload)
      void flush()
    }
  }, [id, showWorksheetViewer])

  const focusEditorFromPaperClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!textModeActive) return
    if (!editor || !editor.isEditable) return
    const target = event.target
    if (!(target instanceof HTMLElement)) return
    if (
      target.closest(
        "button,input,textarea,select,a,.tools-dock,.typewriter-dock,.typing-toolbar,.control-bar,.table-actions,.pad-info-wrapper",
      )
    ) {
      return
    }
    if (!editor.isFocused) {
      editor.commands.focus("end")
    }
  }

  // Notebook-level scroll behavior (stacked pages, append-on-bottom, URL sync)
  // is owned by PadContent. PadEditor only manages its own content lifecycle.

  return (
    <ErrorCapture>
      <div
        className={cn("tiptap-container", showWorksheetViewer && "tiptap-container--worksheet")}
        onMouseDown={focusEditorFromPaperClick}
      >
        {editor ? <PadDropZone id={id} editor={editor} /> : null}
        <div className={`tiptap-box zoom-level-${documentZoom}`}>
          <PaperInkLayer
            noteId={id}
            initialSnapshot={data.inkSnapshot ?? null}
          >
            <div
              className={`pad-editor-scroll${showWorksheetViewer ? " pad-editor-scroll--worksheet" : ""}`}
            >
              {/* Show worksheet view if this is a worksheet (content-based or legacy) */}
              {showWorksheetViewer ? (
                <div className={`worksheet-pad-prose-wrap ${padProseClass}`}>
                  <WorksheetViewer padId={id} content={worksheetContent} legacySections={legacySections || undefined} serverAnswers={data.studentAnswers} onContentChange={setWorksheetContent} />
                </div>
              ) : (
                <ContextMenu
                  condition={(ev) =>
                    (ev.target as HTMLElement).closest("table") ? true : false
                  }
                >
                  <div
                    className="pad-editor-content-shell"
                    aria-label="Note content"
                    onMouseDown={() => {
                      if (!editor || !editor.isEditable) return
                      if (!editor.isFocused) {
                        editor.commands.focus()
                      }
                    }}
                  >
                    <EditorContent
                      key={id}
                      editor={editor}
                      className={`tiptap-main-content ${padProseClass}`}
                      spellCheck={false}
                      onKeyDown={(ev: React.KeyboardEvent<HTMLDivElement>) => {
                        if (!editor) {
                          return
                        }

                        const hasResolvedUser = !!user?.uid
                        const isDifferentOwner = hasResolvedUser && !!data.uid && data.uid !== user?.uid
                        const limitDisabledEdit =
                          data.shared &&
                          data.shared.editedUsers.length <= 0 &&
                          data.shared.accessLevel === Rules.Limit &&
                          isDifferentOwner
                        const anyOneDisabledEdit =
                          data.shared &&
                          data.shared.editedUsers !== ALL_USERS_CAN_EDIT &&
                          data.shared.accessLevel === Rules.Anyone &&
                          isDifferentOwner
                        if (limitDisabledEdit || anyOneDisabledEdit) {
                          ev.preventDefault()
                          return
                        }
                        if (ev.ctrlKey || ev.altKey || ev.metaKey || ev.key === "Escape") {
                          shortCutAction(ev, pressed, editor)
                        }
                      }}
                    />
                  </div>
                  <TableActions editor={editor} />
                </ContextMenu>
              )}
            </div>
          </PaperInkLayer>
        </div>
        <PadInfo />
        <ControlBar editor={editor} />
      </div>
    </ErrorCapture>
  )
}

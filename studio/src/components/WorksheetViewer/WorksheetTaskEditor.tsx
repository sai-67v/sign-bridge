import { useCallback, useEffect, useMemo } from "react"
import { EditorContent, useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import Link from "@tiptap/extension-link"
import Placeholder from "@tiptap/extension-placeholder"
import MarkdownIt from "markdown-it"
import TurndownService from "turndown"
import { usePadEditorStore } from "../../store/padEditorStore"

const mdToHtml = new MarkdownIt({ html: false, breaks: true })
const turndown = new TurndownService({ headingStyle: "atx" })

export function worksheetTaskEditorStoreId(padId: string, taskElementId: string): string {
  return `${padId}__wsTask__${taskElementId}`
}

const taskExtensions = [
  StarterKit.configure({
    codeBlock: false,
  }),
  Underline,
  Link.configure({
    openOnClick: false,
    autolink: true,
  }),
  Placeholder.configure({
    placeholder: "Write the question (headings, lists, bold…)…",
  }),
]

type Props = {
  padId: string
  elementId: string
  markdown: string
  onSave: (markdown: string) => void
  onCancel: () => void
}

export function WorksheetTaskEditor({ padId, elementId, markdown, onSave, onCancel }: Props) {
  const storeId = worksheetTaskEditorStoreId(padId, elementId)
  const registerPadEditor = usePadEditorStore((s) => s.registerPadEditor)
  const setFocusedTypingPadId = usePadEditorStore((s) => s.setFocusedTypingPadId)

  const initialHtml = useMemo(() => mdToHtml.render(markdown || ""), [markdown])

  const editor = useEditor(
    {
      extensions: taskExtensions,
      content: initialHtml,
      editable: true,
      editorProps: {
        attributes: {
          class: "worksheet-task-editor__prose focus:outline-none min-h-[140px] px-1 py-1",
        },
      },
      onFocus: () => {
        setFocusedTypingPadId(storeId)
      },
    },
    [storeId, initialHtml, setFocusedTypingPadId]
  )

  useEffect(() => {
    if (!editor) return
    registerPadEditor(storeId, editor)
    return () => {
      registerPadEditor(storeId, null)
    }
  }, [editor, storeId, registerPadEditor])

  const handleSave = useCallback(() => {
    if (!editor || editor.isDestroyed) return
    const html = editor.getHTML()
    let md = turndown.turndown(html).trim()
    if (!md) md = markdown
    onSave(md)
  }, [editor, markdown, onSave])

  return (
    <div className="worksheet-task-editor">
      <div className="worksheet-task-editor__surface">
        {editor ? <EditorContent editor={editor} /> : null}
      </div>
      <div className="task-edit-actions">
        <button type="button" className="task-save-btn" onClick={handleSave}>
          Save
        </button>
        <button type="button" className="task-cancel-btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}

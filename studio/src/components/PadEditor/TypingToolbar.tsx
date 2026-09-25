import type { Editor } from "@tiptap/react"
import {
  AiOutlineBold,
  AiOutlineCheckSquare,
  AiOutlineComment,
  AiOutlineHighlight,
  AiOutlineItalic,
  AiOutlineOrderedList,
  AiOutlineStrikethrough,
  AiOutlineUnderline,
  AiOutlineUnorderedList,
} from "react-icons/ai"
import {
  MdFormatAlignCenter,
  MdFormatAlignJustify,
  MdFormatAlignLeft,
  MdFormatAlignRight,
  MdRedo,
  MdUndo,
} from "react-icons/md"
import { IoLinkOutline } from "react-icons/io5"
import { HiOutlineCode, HiOutlineMinusSm, HiOutlineTable } from "react-icons/hi"

function canInsertTable(editor: Editor): boolean {
  if (typeof editor.commands.insertTable !== "function") return false
  return editor.can().chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
}

function insertTableDefault(editor: Editor) {
  if (typeof editor.commands.insertTable !== "function") return
  editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
}

/** Full-width ribbon actions (Word-style); also used inside the selection bubble menu. Worksheet pads use WorksheetViewer “Insert /short” / “Insert /long” — TipTap is disabled there. */
export function TypingToolbar({
  editor,
  className = "",
}: {
  editor: Editor | null
  className?: string
}) {
  if (!editor) return null

  const canTable = canInsertTable(editor)

  return (
    <div
      className={`tiptab-format-actions typing-toolbar ${className}`.trim()}
      /* Keep focus + selection in ProseMirror while clicking marks (TipTap menu pattern). */
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="tiptap-action-group">
        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          aria-label="Undo"
        >
          <MdUndo className="h-9 w-9 p-2 rounded-md" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          aria-label="Redo"
        >
          <MdRedo className="h-9 w-9 p-2 rounded-md" />
        </button>
      </div>
      <div className="tiptap-action-group">
        <button
          type="button"
          className={editor.isActive("heading", { level: 1 }) ? "is-active" : ""}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          aria-label="Heading 1"
        >
          <span className="whitespace-nowrap text-sm font-semibold">H1</span>
        </button>
        <button
          type="button"
          className={editor.isActive("heading", { level: 2 }) ? "is-active" : ""}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          aria-label="Heading 2"
        >
          <span className="whitespace-nowrap text-sm font-semibold">H2</span>
        </button>
        <button
          type="button"
          className={editor.isActive("heading", { level: 3 }) ? "is-active" : ""}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          aria-label="Heading 3"
        >
          <span className="whitespace-nowrap text-sm font-semibold">H3</span>
        </button>
      </div>
      <div className="tiptap-action-group">
        <button
          type="button"
          className={editor.isActive("bold") ? "is-active" : ""}
          onClick={() => editor.chain().focus().toggleBold().run()}
          aria-label="Bold"
        >
          <AiOutlineBold className="h-9 w-9 p-2 rounded-md" />
        </button>
        <button
          type="button"
          className={editor.isActive("italic") ? "is-active" : ""}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          aria-label="Italic"
        >
          <AiOutlineItalic className="h-9 w-9 p-2 rounded-md" />
        </button>
        <button
          type="button"
          className={editor.isActive("underline") ? "is-active" : ""}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          aria-label="Underline"
        >
          <AiOutlineUnderline className="h-9 w-9 p-2 rounded-md" />
        </button>
        <button
          type="button"
          className={editor.isActive("strike") ? "is-active" : ""}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          aria-label="Strikethrough"
        >
          <AiOutlineStrikethrough className="h-9 w-9 p-2 rounded-md" />
        </button>
        <button
          type="button"
          className={editor.isActive("code") ? "is-active" : ""}
          onClick={() => editor.chain().focus().toggleCode().run()}
          aria-label="Inline code"
        >
          <HiOutlineCode className="h-9 w-9 p-2 rounded-md" />
        </button>
      </div>
      <div className="tiptap-action-group">
        <button
          type="button"
          className={editor.isActive({ textAlign: "left" }) ? "is-active" : ""}
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          aria-label="Align left"
        >
          <MdFormatAlignLeft className="h-9 w-9 p-2 rounded-md" />
        </button>
        <button
          type="button"
          className={editor.isActive({ textAlign: "center" }) ? "is-active" : ""}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          aria-label="Align center"
        >
          <MdFormatAlignCenter className="h-9 w-9 p-2 rounded-md" />
        </button>
        <button
          type="button"
          className={editor.isActive({ textAlign: "right" }) ? "is-active" : ""}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          aria-label="Align right"
        >
          <MdFormatAlignRight className="h-9 w-9 p-2 rounded-md" />
        </button>
        <button
          type="button"
          className={editor.isActive({ textAlign: "justify" }) ? "is-active" : ""}
          onClick={() => editor.chain().focus().setTextAlign("justify").run()}
          aria-label="Justify"
        >
          <MdFormatAlignJustify className="h-9 w-9 p-2 rounded-md" />
        </button>
      </div>
      <div className="tiptap-action-group">
        <button
          type="button"
          className={editor.isActive("bulletList") ? "is-active" : ""}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          aria-label="Bullet list"
        >
          <AiOutlineUnorderedList className="h-9 w-9 p-2 rounded-md" />
        </button>
        <button
          type="button"
          className={editor.isActive("orderedList") ? "is-active" : ""}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          aria-label="Numbered list"
        >
          <AiOutlineOrderedList className="h-9 w-9 p-2 rounded-md" />
        </button>
        <button
          type="button"
          className={editor.isActive("taskList") ? "is-active" : ""}
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          aria-label="Task list"
        >
          <AiOutlineCheckSquare className="h-9 w-9 p-2 rounded-md" />
        </button>
      </div>
      <div className="tiptap-action-group">
        <button
          type="button"
          className={editor.isActive("blockquote") ? "is-active" : ""}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          aria-label="Quote"
        >
          <AiOutlineComment className="h-9 w-9 p-2 rounded-md" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          aria-label="Horizontal rule"
        >
          <HiOutlineMinusSm className="h-9 w-9 p-2 rounded-md" />
        </button>
        <button
          type="button"
          disabled={!canTable}
          onClick={() => insertTableDefault(editor)}
          aria-label="Insert table"
        >
          <HiOutlineTable className="h-9 w-9 p-2 rounded-md" />
        </button>
        <button
          type="button"
          onClick={() => {
            const url = window.prompt("Enter URL") || ""
            if (url) editor.chain().focus().setLink({ href: url }).run()
          }}
          aria-label="Add link"
        >
          <IoLinkOutline className="h-9 w-9 p-2 rounded-md" />
        </button>
      </div>
      <div className="tiptap-action-group">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHighlight({ color: "#fef08a" }).run()}
          aria-label="Yellow highlight"
        >
          <AiOutlineHighlight
            className="h-9 w-9 p-2 rounded-md text-[var(--editor-text)] border border-[var(--editor-border)] bg-marker/25 hover:bg-marker/40"
            aria-hidden
          />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHighlight({ color: "#99f6e4" }).run()}
          aria-label="Mint highlight"
        >
          <AiOutlineHighlight
            className="h-9 w-9 p-2 rounded-md text-[var(--editor-text)] border border-[var(--editor-border)] bg-marker-mint/25 hover:bg-marker-mint/40"
            aria-hidden
          />
        </button>
      </div>
    </div>
  )
}

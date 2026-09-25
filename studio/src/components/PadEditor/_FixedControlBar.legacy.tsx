import { Editor } from "@tiptap/react"
import { useCallback, useState } from "react"
import {
  AiOutlineBold,
  AiOutlineCheckSquare,
  AiOutlineDash,
  AiOutlineHighlight,
  AiOutlineItalic,
  AiOutlineOrderedList,
  AiOutlinePartition,
  AiOutlineStrikethrough,
  AiOutlineTable,
  AiOutlineUnorderedList,
} from "react-icons/ai"
import { BsCardImage, BsCodeSlash } from "react-icons/bs"
import { IoLinkOutline } from "react-icons/io5"
import { RiDoubleQuotesL, RiSingleQuotesL } from "react-icons/ri"
import { HiOutlinePaperAirplane } from "react-icons/hi"
import PadVideoModal from "./PadVideoModal"
import { InputDialog } from "../InputDialog"
import { TableDialog } from "../TableDialog"
import { IPad } from "../../services/pads"
import { useAuth } from "../../hooks/useAuth"
import DistributeModal from "../../containers/PadActions/DistributeModal"
import { isWorksheetContent } from "../../utils/WorksheetParser"

interface FixedControlBarProps {
  editor: Editor | null
  data?: IPad
  id?: string
}

export default function FixedControlBar({ editor, data, id: _padId }: FixedControlBarProps) {
  const { user } = useAuth()
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const [imageDialogOpen, setImageDialogOpen] = useState(false)
  const [tableDialogOpen, setTableDialogOpen] = useState(false)
  const [distributeOpen, setDistributeOpen] = useState(false)
  const [previousUrl, setPreviousUrl] = useState("")

  const isTeacher = user?.role === "teacher" || user?.role === "admin"
  const isWorksheet = data?.padType === "worksheet" || isWorksheetContent(data?.content ?? "")
  const showDistribute = isTeacher && isWorksheet && data

  const handleLinkSubmit = useCallback((url: string) => {
    if (editor) {
      if (url === "") {
        editor.chain().focus().extendMarkRange("link").unsetLink().run()
      } else {
        editor
          .chain()
          .focus()
          .extendMarkRange("link")
          .setLink({ href: url })
          .run()
      }
    }
  }, [editor])

  const openLinkDialog = useCallback(() => {
    if (editor) {
      const currentUrl = editor.getAttributes("link").href || ""
      setPreviousUrl(currentUrl)
      setLinkDialogOpen(true)
    }
  }, [editor])

  const handleImageSubmit = useCallback((url: string) => {
    if (editor && url) {
      editor.chain().focus().setImage({ src: url }).run()
    }
  }, [editor])

  if (!editor) {
    return null
  }

  return (
    <div className="fixed-controlbar">
      <div className="controlbar-container">
        {/* Text formatting */}
        <div className="controlbar-group">
          <button
            type="button"
            className={editor.isActive("bold") ? "is-active" : ""}
            onClick={() => editor.chain().focus().toggleBold().run()}
            aria-label="Bold"
            title="Bold (Ctrl+B)"
          >
            <AiOutlineBold className="control-icon" />
          </button>
          <button
            type="button"
            className={editor.isActive("italic") ? "is-active" : ""}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            aria-label="Italic"
            title="Italic (Ctrl+I)"
          >
            <AiOutlineItalic className="control-icon" />
          </button>
          <button
            type="button"
            className={editor.isActive("strike") ? "is-active" : ""}
            onClick={() => editor.chain().focus().toggleStrike().run()}
            aria-label="Strikethrough"
            title="Strikethrough"
          >
            <AiOutlineStrikethrough className="control-icon" />
          </button>
          <button
            type="button"
            className={editor.isActive("code") ? "is-active" : ""}
            onClick={() => editor.chain().focus().toggleCode().run()}
            aria-label="Inline code"
            title="Inline code"
          >
            <RiSingleQuotesL className="control-icon" />
          </button>
        </div>

        <div className="controlbar-separator" aria-hidden="true" />

        {/* Headings */}
        <div className="controlbar-group">
          <button
            type="button"
            className={`${editor.isActive("heading", { level: 2 }) ? "is-active" : ""} flex items-center justify-center text-xs`}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            aria-label="Heading 2"
            title="Heading 2"
          >
            <span className="control-icon">h2</span>
          </button>
          <button
            type="button"
            className={`${editor.isActive("heading", { level: 3 }) ? "is-active" : ""} flex items-center justify-center text-xs`}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            aria-label="Heading 3"
            title="Heading 3"
          >
            <span className="control-icon">h3</span>
          </button>
          <button
            type="button"
            className={`${editor.isActive("heading", { level: 4 }) ? "is-active" : ""} flex items-center justify-center text-xs`}
            onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
            aria-label="Heading 4"
            title="Heading 4"
          >
            <span className="control-icon">h4</span>
          </button>
        </div>

        <div className="controlbar-separator" aria-hidden="true" />

        {/* Lists */}
        <div className="controlbar-group">
          <button
            type="button"
            className={editor.isActive("bulletList") ? "is-active" : ""}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            aria-label="Bullet list"
            title="Bullet list"
          >
            <AiOutlineUnorderedList className="control-icon" />
          </button>
          <button
            type="button"
            className={editor.isActive("orderedList") && (editor.getAttributes("orderedList").listType === "decimal" || !editor.getAttributes("orderedList").listType) ? "is-active" : ""}
            onClick={() => {
              if (editor.isActive("orderedList") && editor.getAttributes("orderedList").listType === "decimal") {
                editor.chain().focus().toggleOrderedList().run()
              } else if (editor.isActive("orderedList")) {
                editor.chain().focus().updateAttributes("orderedList", { listType: "decimal" }).run()
              } else {
                editor.chain().focus().toggleOrderedList().run()
              }
            }}
            aria-label="Numbered list"
            title="Numbered list"
          >
            <AiOutlineOrderedList className="control-icon" />
          </button>
          <button
            type="button"
            className={editor.isActive("orderedList") && editor.getAttributes("orderedList").listType === "alpha" ? "is-active" : ""}
            onClick={() => {
              if (editor.isActive("orderedList") && editor.getAttributes("orderedList").listType === "alpha") {
                editor.chain().focus().toggleOrderedList().run()
              } else if (editor.isActive("orderedList")) {
                editor.chain().focus().updateAttributes("orderedList", { listType: "alpha" }).run()
              } else {
                editor.chain().focus().toggleOrderedList().updateAttributes("orderedList", { listType: "alpha" }).run()
              }
            }}
            aria-label="Alphabetic list"
            title="Alphabetic list"
          >
            <span className="control-icon text-[10px] font-bold">abc</span>
          </button>
          <button
            type="button"
            onClick={() => editor.commands.toggleTaskList()}
            aria-label="Task list"
            title="Task list"
          >
            <AiOutlineCheckSquare className="control-icon" />
          </button>
        </div>

        <div className="controlbar-separator" aria-hidden="true" />

        {/* Insert */}
        <div className="controlbar-group">
          <button
            type="button"
            onClick={() => setImageDialogOpen(true)}
            aria-label="Insert image"
            title="Insert image"
          >
            <BsCardImage className="control-icon" />
          </button>
          <button
            type="button"
            onClick={openLinkDialog}
            aria-label="Insert link"
            title="Insert link (Ctrl+K)"
          >
            <IoLinkOutline className="control-icon" />
          </button>
          <button
            type="button"
            className={editor.isActive("codeBlock") && editor.getAttributes("codeBlock")?.language !== "mermaid" ? "is-active" : ""}
            onClick={() => editor.chain().focus().setCodeBlock().run()}
            aria-label="Code block"
            title="Code block"
          >
            <BsCodeSlash className="control-icon" />
          </button>
          <PadVideoModal editor={editor} />
          <button
            type="button"
            className={editor.isActive("codeBlock") && editor.getAttributes("codeBlock")?.language === "mermaid" ? "is-active" : ""}
            onClick={() => editor.chain().focus().setCodeBlock({ language: "mermaid" }).run()}
            aria-label="Mermaid diagram"
            title="Mermaid diagram"
          >
            <AiOutlinePartition className="control-icon" />
          </button>
          <button
            type="button"
            onClick={() => setTableDialogOpen(true)}
            aria-label="Insert table"
            title="Insert table"
          >
            <AiOutlineTable className="control-icon" />
          </button>
        </div>

        <div className="controlbar-separator" aria-hidden="true" />

        {/* Marks */}
        <div className="controlbar-group">
          <button
            type="button"
            onClick={() => editor.commands.toggleHighlight({ color: "#fef08a" })}
            aria-label="Yellow highlight"
            title="Yellow highlight"
          >
            <AiOutlineHighlight className="control-icon w-8 h-8 p-2 rounded-md text-gray-700 bg-yellow-200 hover:bg-yellow-300" />
          </button>
          <button
            type="button"
            onClick={() => editor.commands.toggleHighlight({ color: "#99f6e4" })}
            aria-label="Green highlight"
            title="Green highlight"
          >
            <AiOutlineHighlight className="control-icon w-8 h-8 p-2 rounded-md text-gray-700 bg-green-200 hover:bg-green-300" />
          </button>
          <button
            type="button"
            className={editor.isActive("blockquote") ? "is-active" : ""}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            aria-label="Blockquote"
            title="Blockquote"
          >
            <RiDoubleQuotesL className="control-icon" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            aria-label="Horizontal rule"
            title="Horizontal rule"
          >
            <AiOutlineDash className="control-icon" />
          </button>
        </div>

        {showDistribute && (
          <>
            <div className="controlbar-separator" aria-hidden="true" />
            <div className="controlbar-group controlbar-group-distribute">
              <button
                type="button"
                className="control-icon-send"
                onClick={() => setDistributeOpen(true)}
                aria-label="Send to class"
                title="Send to class"
              >
                <HiOutlinePaperAirplane className="control-icon" aria-hidden="true" />
                <span className="control-icon-label">Send to Class</span>
              </button>
            </div>
          </>
        )}
      </div>

      {distributeOpen && data && (
        <DistributeModal pad={data} onClose={() => setDistributeOpen(false)} />
      )}

      <InputDialog
        isOpen={linkDialogOpen}
        onClose={() => setLinkDialogOpen(false)}
        onSubmit={handleLinkSubmit}
        title="Insert Link"
        placeholder="Enter URL (e.g., https://example.com)"
        defaultValue={previousUrl}
        submitLabel="Add Link"
      />

      <InputDialog
        isOpen={imageDialogOpen}
        onClose={() => setImageDialogOpen(false)}
        onSubmit={handleImageSubmit}
        title="Insert Image"
        placeholder="Enter image URL"
        submitLabel="Add Image"
      />

      <TableDialog
        isOpen={tableDialogOpen}
        onClose={() => setTableDialogOpen(false)}
        editor={editor}
      />
    </div>
  )
}

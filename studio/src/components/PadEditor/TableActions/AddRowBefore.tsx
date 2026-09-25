import { Editor } from "@tiptap/react"
import { TbRowInsertBottom } from "react-icons/tb"

export const AddRowBefore = ({ editor }: { editor: Editor }) => {
  return (
    <button
      type="button"
      className="group dropdown-content flex items-center w-full px-4 py-2 text-sm text-left bg-none border-none cursor-pointer"
      onClick={() => editor.chain().focus().addRowBefore().run()}
      aria-label="Add row before"
    >
      <TbRowInsertBottom className="dropdown-icon" aria-hidden="true" />
      <span className="dropdown-text">Add Row Before</span>
    </button>
  )
}

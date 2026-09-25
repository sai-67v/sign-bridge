import { Editor } from "@tiptap/react"
import { TbColumnInsertRight } from "react-icons/tb"

export const AddColumnBefore = ({ editor }: { editor: Editor }) => {
  return (
    <button
      type="button"
      className="group dropdown-content flex items-center w-full px-4 py-2 text-sm text-left bg-none border-none cursor-pointer"
      onClick={() => editor.chain().focus().addColumnBefore().run()}
      aria-label="Add column before"
    >
      <TbColumnInsertRight className="dropdown-icon" aria-hidden="true" />
      <span className="dropdown-text">Add Column Before</span>
    </button>
  )
}

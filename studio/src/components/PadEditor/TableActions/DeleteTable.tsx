import { Editor } from "@tiptap/react"
import { TbTableOff } from "react-icons/tb"

export const DeleteTable = ({ editor }: { editor: Editor }) => {
  return (
    <button
      type="button"
      className="group dropdown-content flex items-center w-full px-4 py-2 text-sm text-left bg-none border-none cursor-pointer"
      onClick={() => editor.chain().focus().deleteTable().run()}
      aria-label="Delete table"
    >
      <TbTableOff className="dropdown-icon" aria-hidden="true" />
      <span className="dropdown-text">Delete Table</span>
    </button>
  )
}

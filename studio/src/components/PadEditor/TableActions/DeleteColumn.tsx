import { Editor } from "@tiptap/react"
import { RiDeleteColumn } from "react-icons/ri"

export const DeleteColumn = ({ editor }: { editor: Editor }) => {
  return (
    <button
      type="button"
      className="group dropdown-content flex items-center w-full px-4 py-2 text-sm text-left bg-none border-none cursor-pointer"
      onClick={() => editor.chain().focus().deleteColumn().run()}
      aria-label="Delete column"
    >
      <RiDeleteColumn className="dropdown-icon" aria-hidden="true" />
      <span className="dropdown-text">Delete Column</span>
    </button>
  )
}

import { Editor } from "@tiptap/react"
import { RiDeleteRow } from "react-icons/ri"

export const DeleteRow = ({ editor }: { editor: Editor }) => {
  return (
    <button
      type="button"
      className="group dropdown-content flex items-center w-full px-4 py-2 text-sm text-left bg-none border-none cursor-pointer"
      onClick={() => editor.chain().focus().deleteRow().run()}
      aria-label="Delete row"
    >
      <RiDeleteRow className="dropdown-icon" aria-hidden="true" />
      <span className="dropdown-text">Delete Row</span>
    </button>
  )
}

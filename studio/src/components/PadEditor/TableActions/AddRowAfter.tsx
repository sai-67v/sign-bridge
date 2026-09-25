import { Editor } from "@tiptap/react"
import { TbRowInsertTop } from "react-icons/tb"

export const AddRowAfter = ({ editor }: { editor: Editor }) => {
  return (
    <button
      type="button"
      className="group dropdown-content flex items-center w-full px-4 py-2 text-sm text-left bg-none border-none cursor-pointer"
      onClick={() => editor.chain().focus().addRowAfter().run()}
      aria-label="Add row after"
    >
      <TbRowInsertTop className="dropdown-icon" aria-hidden="true" />
      <span className="dropdown-text">Add Row After</span>
    </button>
  )
}

import { BubbleMenu } from "@tiptap/react"
import type { Editor } from "@tiptap/react"
import { TypingToolbar } from "./TypingToolbar"
import { usePaperUiStore } from "../../store/paperUiStore"

interface IControlBarProps {
  editor: Editor | null
}

const ControlBar = ({ editor }: IControlBarProps) => {
  /** Keep BubbleMenu mounted when hiding — unmounting fights Tippy DOM moves (removeChild errors). */
  const hideBubbleForTopTypeRibbon = usePaperUiStore(
    (s) => s.dualChromeEnabled && s.expandedChromePanel === "type"
  )

  if (!editor) {
    return null
  }

  /** Worksheet (and other read-only) pads mount no `EditorContent`; BubbleMenu/Tippy still touches the doc and causes insertBefore/removeChild reconciliation errors. */
  if (!editor.isEditable) {
    return null
  }

  return (
    <BubbleMenu
      editor={editor}
      shouldShow={({ editor: ed }) =>
        ed.isEditable &&
        !ed.state.selection.empty &&
        !hideBubbleForTopTypeRibbon
      }
      tippyOptions={{ duration: [200, 150] }}
    >
      <TypingToolbar editor={editor} />
    </BubbleMenu>
  )
}

export default ControlBar

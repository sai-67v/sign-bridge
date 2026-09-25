import { HiOutlineUpload } from "react-icons/hi"
import { AiOutlineClose } from "react-icons/ai"
import { useWorkspaceStore } from "../../store/workspaceStore"

export function MaterialResizer() {
  const materialPaneOpen = useWorkspaceStore((s) => s.materialPaneOpen)
  const toggleMaterialPane = useWorkspaceStore((s) => s.toggleMaterialPane)

  return (
    <div
      className="pad-material-divider"
      role="separator"
      aria-orientation="vertical"
      aria-label={materialPaneOpen ? "Material panel controls" : "Show material panel"}
    >
      <div className="pad-material-divider__pill">
        <button
          type="button"
          className="pad-material-divider__toggle"
          onClick={(e) => {
            e.stopPropagation()
            toggleMaterialPane()
          }}
          title={materialPaneOpen ? "Hide PDF / material" : "Show PDF / material"}
          aria-expanded={materialPaneOpen}
        >
          {materialPaneOpen ? (
            <AiOutlineClose className="h-5 w-5" aria-hidden />
          ) : (
            <HiOutlineUpload className="h-5 w-5" aria-hidden />
          )}
        </button>
      </div>
    </div>
  )
}

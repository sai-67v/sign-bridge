import { lazy, Suspense } from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Dialog, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog"
import { AiOutlineClose } from "react-icons/ai"
import { useOverlayStore, type OverlayKind } from "../../store/overlayStore"

const NotificationsPanel = lazy(
  () => import("../../containers/NotificationsPanel")
)
const ClassroomManager = lazy(
  () => import("../../containers/ClassroomManager")
)
const SubmissionsDashboard = lazy(
  () => import("../../containers/SubmissionsDashboard")
)
const SettingsOverlayBody = lazy(() => import("./SettingsOverlayBody"))
const PaperSettingsOverlayBody = lazy(() => import("./PaperSettingsOverlayBody"))

const TITLES: Record<Exclude<OverlayKind, null>, string> = {
  settings: "Settings",
  submissions: "Submissions",
  notifications: "Notifications",
  classrooms: "Classrooms",
  "paper-settings": "Page settings",
}

function OverlayBody({ kind }: { kind: Exclude<OverlayKind, null> }) {
  switch (kind) {
    case "notifications":
      return <NotificationsPanel titleInChrome />
    case "classrooms":
      return <ClassroomManager />
    case "submissions":
      return <SubmissionsDashboard />
    case "settings":
      return <SettingsOverlayBody />
    case "paper-settings":
      return <PaperSettingsOverlayBody />
    default:
      return null
  }
}

/**
 * Notion-style overlay host. Renders the chosen page over the current
 * editor without changing routes.
 */
export function OverlayHost() {
  const kind = useOverlayStore((s) => s.kind)
  const close = useOverlayStore((s) => s.close)
  const isOpen = kind != null

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) close()
      }}
    >
      <DialogPortal>
        <DialogOverlay className="z-[180] bg-black/35" />
        <DialogPrimitive.Content
          className="pad-overlay-panel fixed left-1/2 top-1/2 z-[181] -translate-x-1/2 -translate-y-1/2 animate-in fade-in-0 zoom-in-95 duration-200 focus:outline-none"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <header className="pad-overlay-panel__header">
            <DialogTitle className="pad-overlay-panel__title">
              {kind ? TITLES[kind] : ""}
            </DialogTitle>
            <button
              type="button"
              className="pad-overlay-panel__close"
              onClick={close}
              aria-label="Close overlay"
            >
              <AiOutlineClose className="h-5 w-5" aria-hidden />
            </button>
          </header>
          <div className="pad-overlay-panel__body">
            <Suspense fallback={<div className="p-6 text-sm">Loading…</div>}>
              {kind ? <OverlayBody kind={kind} /> : null}
            </Suspense>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  )
}

import { useEffect, useState } from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Dialog, DialogOverlay, DialogPortal } from "@/components/ui/dialog"
import { AiOutlineMenu } from "react-icons/ai"
import { HiOutlineBell, HiOutlineCog, HiOutlineHome } from "react-icons/hi"
import { useLocation, useMatch, useNavigate } from "react-router-dom"
import Settings from "../../containers/Settings"
import { useAuth } from "../../hooks/useAuth"
import { useNotificationStore } from "../../store/notificationStore"
import { useOverlayStore } from "../../store/overlayStore"
import { useWorkspaceStore } from "../../store/workspaceStore"
import { flushPendingPadSaveForNote } from "../../services/pendingPadSaveFlush"
import "./AppSidebar.css"

export default function AppSidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  /** Open pad document only — not `/app/pad`, not `/app/pad/classroom/...`. */
  const openPadPageMatch = useMatch({ path: "/app/pad/:id", end: true })
  const pageSettingsEnabled = openPadPageMatch != null
  const { user } = useAuth()
  const { unreadCount, fetchNotifications, subscribeRealtime, unsubscribeRealtime } = useNotificationStore()
  const openOverlay = useOverlayStore((s) => s.open)
  const setSelectedFolderId = useWorkspaceStore((s) => s.setSelectedFolderId)
  const setMediumFilter = useWorkspaceStore((s) => s.setMediumFilter)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [narrow, setNarrow] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)")
    const apply = () => setNarrow(mq.matches)
    apply()
    mq.addEventListener("change", apply)
    return () => mq.removeEventListener("change", apply)
  }, [])

  useEffect(() => {
    if (!user?.uid) return
    fetchNotifications(user.uid)
    subscribeRealtime(user.uid)
    return () => unsubscribeRealtime()
  }, [user?.uid, fetchNotifications, subscribeRealtime, unsubscribeRealtime])

  const goPadHome = async () => {
    const noteId = openPadPageMatch?.params?.id
    if (noteId) {
      await flushPendingPadSaveForNote(noteId)
    }
    setSelectedFolderId(null)
    setMediumFilter("all")
    navigate("/app/pad")
    if (narrow) setMobileOpen(false)
  }

  const rail = (
    <nav className="app-sidebar__rail" aria-label="Main navigation">
      <button
        type="button"
        className="app-sidebar__rail-btn"
        title="Home"
        aria-label="Home"
        aria-current={location.pathname === "/app/pad" ? "page" : undefined}
        onClick={goPadHome}
      >
        <HiOutlineHome className="h-5 w-5" aria-hidden />
      </button>
      <div
        className={`app-sidebar__rail-settings-slot${pageSettingsEnabled ? " app-sidebar__rail-settings-slot--expanded" : ""}`}
        aria-hidden={!pageSettingsEnabled}
      >
        <button
          type="button"
          className="app-sidebar__rail-btn"
          title="Page settings"
          aria-label="Page settings"
          tabIndex={pageSettingsEnabled ? undefined : -1}
          onClick={() => {
            if (!pageSettingsEnabled) return
            openOverlay("paper-settings")
            if (narrow) setMobileOpen(false)
          }}
        >
          <HiOutlineCog className="h-5 w-5" aria-hidden />
        </button>
      </div>
      <button
        type="button"
        className="app-sidebar__rail-btn app-sidebar__rail-btn--notify"
        title="Notifications"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        onClick={() => {
          openOverlay("notifications")
          if (narrow) setMobileOpen(false)
        }}
      >
        <HiOutlineBell className="h-5 w-5" aria-hidden />
        {unreadCount > 0 ? (
          <span className="app-sidebar__rail-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>
        ) : null}
      </button>
      <div className="app-sidebar__rail-spacer" aria-hidden />
      {user ? (
        <div className="app-sidebar__rail-profile">
          <Settings profileMenuVariant="icon-rail" />
        </div>
      ) : null}
    </nav>
  )

  if (narrow) {
    return (
      <>
        <button
          type="button"
          className="app-sidebar__mobile-fab"
          aria-label="Open menu"
          title="Open menu"
          onClick={() => setMobileOpen(true)}
        >
          <AiOutlineMenu className="h-5 w-5" aria-hidden />
        </button>
        <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
          <DialogPortal>
            <DialogOverlay className="z-[200] bg-black/30" />
            <DialogPrimitive.Content
              className="app-sidebar app-sidebar--rail app-sidebar--mobile fixed inset-y-0 left-0 z-[201] flex w-[4.5rem] max-w-full flex-col border-r border-[color:var(--common-border-light-color)] bg-[color:var(--sidebar-background-color)] shadow-xl outline-none data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-150 data-[state=open]:duration-200"
              onOpenAutoFocus={(e) => e.preventDefault()}
            >
              <div className="app-sidebar__inner app-sidebar__inner--rail">{rail}</div>
            </DialogPrimitive.Content>
          </DialogPortal>
        </Dialog>
      </>
    )
  }

  return (
    <aside className="app-sidebar app-sidebar--rail shrink-0" aria-label="Main navigation">
      <div className="app-sidebar__inner app-sidebar__inner--rail">{rail}</div>
    </aside>
  )
}

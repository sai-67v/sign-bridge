import { Outlet } from "react-router-dom"
import Autoupdate from "../Autoupdate"
import Shortcut from "../Shortcut/Shortcut"
import { isDesktopApp } from "../../libs/utils"
import ThemeSelection from "../../containers/Theme/ThemeSelection"
import AppMiddleware from "../../providers/AppMiddleware"
import CommandPalletes from "../../containers/CommandPalletes"
import { PadShareModal } from "../../containers/PadActions/PadShareModal"
import AppSidebar from "../AppSidebar/AppSidebar"
import ShortcutModal from "../../containers/Settings/ShortcutModal"

export default function Layout() {
  return (
    <AppMiddleware>
      <>
        <CommandPalletes />
        <div className="app-workspace-shell flex flex-row h-screen w-full min-h-0 overflow-hidden">
          <AppSidebar />
          <main className="main-content flex-1 overflow-y-auto relative min-w-0 min-h-0">
            <Outlet />
          </main>
        </div>
        <Shortcut />
        <ShortcutModal />
        <ThemeSelection />
        <PadShareModal />
        {isDesktopApp() ? <Autoupdate /> : null}
      </>
    </AppMiddleware>
  )
}

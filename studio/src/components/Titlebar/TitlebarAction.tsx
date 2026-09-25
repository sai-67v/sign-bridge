import { useState } from "react"
import {
  VscChromeClose,
  VscChromeMaximize,
  VscChromeMinimize,
  VscChromeRestore,
} from "react-icons/vsc"

function TitlebarAction() {
  const [isMaximize, setIsMaximize] = useState(false)

  const onMaximize = async () => {
    if (!window.__TAURI_METADATA__) return
    const { appWindow } = await import("@tauri-apps/api/window")
    setIsMaximize(true)
    appWindow.toggleMaximize()
  }
  const onRestore = async () => {
    if (!window.__TAURI_METADATA__) return
    const { appWindow } = await import("@tauri-apps/api/window")
    setIsMaximize(false)
    appWindow.toggleMaximize()
  }

  const onClose = async () => {
    if (!window.__TAURI_METADATA__) return
    const { appWindow } = await import("@tauri-apps/api/window")
    appWindow.close()
  }

  const onMinimize = async () => {
    if (!window.__TAURI_METADATA__) return
    const { appWindow } = await import("@tauri-apps/api/window")
    appWindow.minimize()
  }

  return (
    <div className="flex items-center">
      <span onClick={onMinimize} className="ttb-icon ttb-min">
        <VscChromeMinimize />
      </span>
      {!isMaximize && (
        <span onClick={onMaximize} className="ttb-icon ttb-max">
          <VscChromeMaximize />
        </span>
      )}

      {isMaximize && (
        <span onClick={onRestore} className="ttb-icon ttb-restore">
          <VscChromeRestore />
        </span>
      )}

      <span onClick={onClose} className="ttb-icon ttb-close">
        <VscChromeClose />
      </span>
    </div>
  )
}

export default TitlebarAction

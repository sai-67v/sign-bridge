import { useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { createQuickPad } from "../../containers/Pads/quickCreatePad"
import { useAuth } from "../../hooks/useAuth"
import { usePadStore } from "../../store"
import { KeyBoardProps, setCreateNewPadShortcutHandler, shortCutAction } from "./ShortcutAction"

const baseKeys: KeyBoardProps = {
  shift: false,
  control: false,
  enter: false,
  b: false,
  p: false,
  alt: false,
  escape: false,
  t: false,
  i: false,
  v: false,
  d: false,
  s: false,
  c: false,
  r: false,
  n: false,
  o: false,
  minus: false,
  equal: false,
  zero: false,
}

export let pressed: KeyBoardProps = { ...baseKeys }

export default function Shortcut() {
  const ref = useRef(null)
  const navigate = useNavigate()
  const { user } = useAuth()
  const bumpPadList = usePadStore((state) => state.setNeedToUpdate)

  useEffect(() => {
    setCreateNewPadShortcutHandler(async () => {
      if (!user?.uid) return
      await createQuickPad({
        uid: user.uid,
        navigate,
        bumpPadList,
      })
    })
    return () => setCreateNewPadShortcutHandler(null)
  }, [user?.uid, navigate, bumpPadList])

  useEffect(() => {
    const handleDown = (ev: KeyboardEvent) => {
      const el = ev.target
      if (el instanceof HTMLElement) {
        const inEditor =
          el.closest(".ProseMirror") != null ||
          el.isContentEditable ||
          el.closest(".tiptap-main-content") != null
        if (
          inEditor &&
          !ev.ctrlKey &&
          !ev.altKey &&
          !ev.metaKey &&
          ev.key.length === 1
        ) {
          return
        }
      }
      shortCutAction(ev, pressed)
    }

    const handleUp = () => {
      pressed = { ...baseKeys }
    }

    document.addEventListener("keydown", handleDown)
    document.addEventListener("keyup", handleUp)
    return () => {
      document.removeEventListener("keydown", handleDown)
      document.removeEventListener("keyup", handleUp)
    }
  }, [])

  return <div ref={ref} tabIndex={-1}></div>
}

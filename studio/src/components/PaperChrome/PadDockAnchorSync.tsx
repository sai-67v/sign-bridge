import { useLayoutEffect, type RefObject } from "react"

/** Sets `--pad-dock-anchor-x` on `:root` so fixed tool docks align with the paper card center, not the viewport. */
export const PAD_DOCK_ANCHOR_VAR = "--pad-dock-anchor-x"

export function PadDockAnchorSync({
  editorRef,
}: {
  editorRef: RefObject<HTMLElement | null>
}) {
  useLayoutEffect(() => {
    const root = editorRef.current
    if (!root) return

    let paperObserved: Element | null = null

    const update = () => {
      const paper = root.querySelector<HTMLElement>(".paper-sheet__body")
      if (paper !== paperObserved) {
        if (paperObserved) ro.unobserve(paperObserved)
        paperObserved = paper
        if (paper) ro.observe(paper)
      }
      const target = paper ?? root
      const r = target.getBoundingClientRect()
      const cx = Math.round(r.left + r.width / 2)
      document.documentElement.style.setProperty(PAD_DOCK_ANCHOR_VAR, `${cx}px`)
    }

    const ro = new ResizeObserver(() => update())
    ro.observe(root)

    update()
    requestAnimationFrame(update)

    window.addEventListener("resize", update)

    const main = root.closest("main.main-content")
    main?.addEventListener("scroll", update, { passive: true })

    return () => {
      if (paperObserved) ro.unobserve(paperObserved)
      ro.unobserve(root)
      ro.disconnect()
      window.removeEventListener("resize", update)
      main?.removeEventListener("scroll", update)
      document.documentElement.style.removeProperty(PAD_DOCK_ANCHOR_VAR)
    }
  }, [editorRef])

  return null
}

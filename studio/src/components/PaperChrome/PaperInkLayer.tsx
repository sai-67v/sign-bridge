import type { ReactNode } from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import { paperUiPenColor, paperUiPenWidths, usePaperUiStore } from "../../store/paperUiStore"
import { EMPTY_INK_SNAPSHOT, type InkSnapshot, type InkStroke } from "../../types/paperProfile"
import type { PenModality } from "../../types/paperProfile"
import { updatePadInkSnapshot } from "../../services/pads"

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/** Clicks under this distance are treated as UI interaction (focus editor), not ink. */
const INK_DRAG_THRESHOLD_PX = 4

type DragInkModality = Exclude<PenModality, "eraser" | "dot">

function strokePath(stroke: InkStroke): string {
  if (stroke.points.length === 0) return ""
  if (stroke.points.length === 1) {
    const p = stroke.points[0]
    return `M ${p.x} ${p.y} l 0.1 0`
  }
  return stroke.points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ")
}

function distanceToStroke(x: number, y: number, stroke: InkStroke): number {
  return stroke.points.reduce((best, p) => {
    const d = Math.hypot(p.x - x, p.y - y)
    return Math.min(best, d)
  }, Number.POSITIVE_INFINITY)
}

function isChromeTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return !!target.closest(
    "button,input,textarea,select,a,.control-bar,.table-actions,.paper-template-menu,.tools-dock,.typewriter-dock,.typing-toolbar,.pad-info-wrapper,.pad-material-divider"
  )
}

type Props = {
  noteId: string
  initialSnapshot?: InkSnapshot | null
  children: ReactNode
}

export function PaperInkLayer({ noteId, initialSnapshot, children }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const activeStrokeRef = useRef<InkStroke | null>(null)
  const pendingInkRef = useRef<{
    pointerId: number
    modality: DragInkModality
    startPoint: { x: number; y: number; t: number }
  } | null>(null)
  const persistTimer = useRef<number | null>(null)
  const [snapshot, setSnapshot] = useState<InkSnapshot>(initialSnapshot ?? EMPTY_INK_SNAPSHOT)
  const penModality = usePaperUiStore((s) => s.penModality)
  const penWidthIndex = usePaperUiStore((s) => s.penWidthIndex)
  const dualChrome = usePaperUiStore((s) => s.dualChromeEnabled)
  const expandedChrome = usePaperUiStore((s) => s.expandedChromePanel)
  const suspendInkForTyping = dualChrome && expandedChrome === "type"

  useEffect(() => {
    setSnapshot(initialSnapshot ?? EMPTY_INK_SNAPSHOT)
  }, [initialSnapshot, noteId])

  useEffect(() => {
    return () => {
      if (persistTimer.current) window.clearTimeout(persistTimer.current)
    }
  }, [])

  const width = useMemo(() => {
    const widths = paperUiPenWidths()
    return widths[penWidthIndex] ?? widths[1]
  }, [penWidthIndex])

  const pointFor = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = hostRef.current?.getBoundingClientRect()
    if (!rect) return null
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      t: Date.now(),
    }
  }

  const persist = (next: InkSnapshot) => {
    if (persistTimer.current) window.clearTimeout(persistTimer.current)
    persistTimer.current = window.setTimeout(() => {
      updatePadInkSnapshot(noteId, next).catch((error) => {
        console.error("Failed to persist ink snapshot", error)
      })
    }, 450)
  }

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (suspendInkForTyping) return
    if (event.button !== 0) return
    if (isChromeTarget(event.target)) return
    const point = pointFor(event)
    if (!point) return

    if (penModality === "eraser") {
      setSnapshot((prev) => {
        const next = {
          version: 1 as const,
          strokes: prev.strokes.filter((stroke) => distanceToStroke(point.x, point.y, stroke) > 18),
        }
        persist(next)
        return next
      })
      return
    }

    if (penModality === "dot") {
      const stroke: InkStroke = {
        id: uid(),
        modality: penModality,
        color: paperUiPenColor(),
        width: width * 5,
        points: [point, { ...point, x: point.x + 0.1 }],
      }
      activeStrokeRef.current = stroke
      event.currentTarget.setPointerCapture(event.pointerId)
      setSnapshot((prev) => {
        const next = { version: 1 as const, strokes: [...prev.strokes, stroke] }
        persist(next)
        return next
      })
      return
    }

    pendingInkRef.current = {
      pointerId: event.pointerId,
      modality: penModality,
      startPoint: point,
    }
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (suspendInkForTyping) return

    const pend = pendingInkRef.current
    if (
      pend &&
      pend.pointerId === event.pointerId &&
      !activeStrokeRef.current &&
      (pend.modality === "pen" || pend.modality === "pencil" || pend.modality === "marker")
    ) {
      const pt = pointFor(event)
      if (
        pt &&
        Math.hypot(pt.x - pend.startPoint.x, pt.y - pend.startPoint.y) >= INK_DRAG_THRESHOLD_PX
      ) {
        const modality = pend.modality
        const stroke: InkStroke = {
          id: uid(),
          modality,
          color: paperUiPenColor(),
          width: modality === "marker" ? width * 4 : width,
          points: [pend.startPoint],
        }
        if (pt.x !== pend.startPoint.x || pt.y !== pend.startPoint.y) {
          stroke.points.push(pt)
        }
        pendingInkRef.current = null
        activeStrokeRef.current = stroke
        event.currentTarget.setPointerCapture(event.pointerId)
        setSnapshot((prev) => {
          const next = { version: 1 as const, strokes: [...prev.strokes, stroke] }
          persist(next)
          return next
        })
        return
      }
    }

    const active = activeStrokeRef.current
    if (!active || penModality === "dot") return
    const movePoint = pointFor(event)
    if (!movePoint) return

    active.points.push(movePoint)
    setSnapshot((prev) => ({
      version: 1 as const,
      strokes: prev.strokes.map((s) => (s.id === active.id ? { ...active } : s)),
    }))
  }

  const finishPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    const pid = event.pointerId

    if (pendingInkRef.current?.pointerId === pid) {
      pendingInkRef.current = null
    }

    try {
      event.currentTarget.releasePointerCapture(pid)
    } catch {
      /* pointer capture can already be released by the browser */
    }

    const active = activeStrokeRef.current
    activeStrokeRef.current = null

    if (!active) return

    if (suspendInkForTyping) {
      return
    }

    setSnapshot((prev) => {
      const next = {
        version: 1 as const,
        strokes: prev.strokes.map((stroke) =>
          stroke.id === active.id ? { ...active } : stroke
        ),
      }
      persist(next)
      return next
    })
  }

  useEffect(() => {
    if (!suspendInkForTyping) return
    pendingInkRef.current = null
    activeStrokeRef.current = null
  }, [suspendInkForTyping])

  /** In text/type mode, do not register ink handlers at all — avoids bubbling + capture fighting ProseMirror and the ribbon. */
  const inkPointerHandlers = suspendInkForTyping
    ? {}
    : {
        onPointerDown,
        onPointerMove,
        onPointerUp: finishPointer,
        onPointerCancel: finishPointer,
      }

  return (
    <div
      ref={hostRef}
      className="paper-ink-host"
      {...inkPointerHandlers}
    >
      {children}
      <svg className="paper-ink-layer" aria-hidden>
        {snapshot.strokes.map((stroke) => (
          <path
            key={stroke.id}
            d={strokePath(stroke)}
            fill="none"
            stroke={stroke.color}
            strokeWidth={stroke.width}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={stroke.modality === "marker" ? 0.3 : stroke.modality === "pencil" ? 0.65 : 1}
          />
        ))}
      </svg>
    </div>
  )
}

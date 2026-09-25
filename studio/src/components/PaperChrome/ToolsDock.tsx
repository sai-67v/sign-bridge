import { createPortal } from "react-dom"
import {
  HiOutlinePencil,
  HiOutlinePencilAlt,
  HiOutlineMinus,
  HiOutlineDocumentText,
} from "react-icons/hi"
import { BsEraser, BsPin } from "react-icons/bs"
import type { PenModality } from "../../types/paperProfile"
import { PAPER_UI_PEN_COLORS, usePaperUiStore } from "../../store/paperUiStore"

const MODALITIES: {
  id: PenModality
  label: string
  Icon: typeof HiOutlinePencil
}[] = [
  { id: "pencil", label: "Pencil", Icon: HiOutlinePencil },
  { id: "pen", label: "Pen", Icon: HiOutlinePencilAlt },
  { id: "marker", label: "Marker", Icon: HiOutlineMinus },
  { id: "eraser", label: "Eraser", Icon: BsEraser },
  { id: "dot", label: "Pin", Icon: BsPin },
]

/**
 * Floating bottom-center tools dock per editor mockup.
 * - Pen modalities (visual only — see spec 002 phase 8 for real ink)
 * - Color cycle
 * - Width cycle
 * - Star = AI assistant toggle (replaces large AI rail icon)
 */
export function ToolsDock() {
  const penModality = usePaperUiStore((s) => s.penModality)
  const setPenModality = usePaperUiStore((s) => s.setPenModality)
  const cyclePenColor = usePaperUiStore((s) => s.cyclePenColor)
  const cyclePenWidth = usePaperUiStore((s) => s.cyclePenWidth)
  const penWidthIndex = usePaperUiStore((s) => s.penWidthIndex)
  const penColorIndex = usePaperUiStore((s) => s.penColorIndex)
  const dualChrome = usePaperUiStore((s) => s.dualChromeEnabled)
  const expandedChromePanel = usePaperUiStore((s) => s.expandedChromePanel)
  const openTypePanel = usePaperUiStore((s) => s.openTypePanel)
  const color = PAPER_UI_PEN_COLORS[penColorIndex] ?? PAPER_UI_PEN_COLORS[0]
  const widthLabels = ["S", "M", "L"] as const

  const showDrawDock = !dualChrome || expandedChromePanel === "draw"
  if (!showDrawDock) return null

  const dock = (
    <div className="tools-dock" role="toolbar" aria-label="Drawing tools">
      <div className="tools-dock__group" aria-label="Pens">
        {MODALITIES.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            title={label}
            aria-pressed={penModality === id}
            className={`tools-dock__btn ${
              penModality === id ? "tools-dock__btn--active" : ""
            }`}
            onClick={() => setPenModality(id)}
          >
            <Icon className="h-4 w-4" aria-hidden />
            <span className="sr-only">{label}</span>
          </button>
        ))}
      </div>
      <button
        type="button"
        className="tools-dock__color"
        style={{ backgroundColor: color }}
        title="Cycle ink color"
        aria-label="Cycle ink color"
        onClick={() => cyclePenColor()}
      />
      <button
        type="button"
        className="tools-dock__btn tools-dock__width"
        title="Cycle stroke weight"
        onClick={() => cyclePenWidth()}
      >
        <span className="text-[0.7rem] font-semibold tabular-nums">
          {widthLabels[penWidthIndex] ?? "M"}
        </span>
      </button>
      {dualChrome ? (
        <button
          type="button"
          className="tools-dock__btn"
          title="Switch to text tools"
          aria-label="Switch to text tools"
          onClick={() => openTypePanel()}
        >
          <HiOutlineDocumentText className="h-4 w-4" aria-hidden />
          <span className="sr-only">Text tools</span>
        </button>
      ) : null}
    </div>
  )

  if (typeof document === "undefined") return null

  return createPortal(dock, document.body)
}

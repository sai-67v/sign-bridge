import type { PenModality } from "../../types/paperProfile"
import { PAPER_UI_PEN_COLORS, usePaperUiStore, paperUiPenWidths } from "../../store/paperUiStore"

const MODALITIES: { id: PenModality; label: string }[] = [
  { id: "pencil", label: "Pencil" },
  { id: "pen", label: "Pen" },
  { id: "marker", label: "Marker" },
  { id: "eraser", label: "Eraser" },
  { id: "dot", label: "Pin" },
]

export function PenToolStrip() {
  const penModality = usePaperUiStore((s) => s.penModality)
  const setPenModality = usePaperUiStore((s) => s.setPenModality)
  const cyclePenColor = usePaperUiStore((s) => s.cyclePenColor)
  const cyclePenWidth = usePaperUiStore((s) => s.cyclePenWidth)
  const penWidthIndex = usePaperUiStore((s) => s.penWidthIndex)
  const penColorIndex = usePaperUiStore((s) => s.penColorIndex)
  const color = PAPER_UI_PEN_COLORS[penColorIndex] ?? PAPER_UI_PEN_COLORS[0]
  const widths = paperUiPenWidths()
  const w = widths[penWidthIndex] ?? widths[1]

  return (
    <div className="pen-tool-strip flex flex-wrap items-center gap-1 border-l border-[var(--common-border-light-color)] pl-2">
      <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--common-dark-text-color)]">
        Pen
      </span>
      <div className="flex flex-wrap gap-0.5" role="toolbar" aria-label="Pen tools (visual only)">
        {MODALITIES.map((m) => (
          <button
            key={m.id}
            type="button"
            title={`${m.label} (preview)`}
            className={`rounded px-1.5 py-0.5 text-[0.7rem] ${
              penModality === m.id
                ? "bg-[var(--common-primary-color)] text-[var(--common-primary-text-color)]"
                : "border border-transparent bg-[var(--common-btn-bg-color)] text-[var(--common-text-color)] hover:bg-[var(--common-btn-bg-hover-color)]"
            }`}
            onClick={() => setPenModality(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="ml-1 flex h-6 w-6 items-center justify-center rounded border border-[var(--common-border-color)]"
        style={{ backgroundColor: color }}
        title="Cycle ink color"
        aria-label="Cycle ink color"
        onClick={() => cyclePenColor()}
      />
      <button
        type="button"
        className="rounded border border-[var(--common-border-color)] bg-[var(--common-btn-bg-color)] px-2 py-0.5 text-[0.7rem] text-[var(--common-text-color)] hover:bg-[var(--common-btn-bg-hover-color)]"
        title="Cycle stroke weight"
        onClick={() => cyclePenWidth()}
      >
        {w}px
      </button>
    </div>
  )
}

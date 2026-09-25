import { PAPER_SIZE_OPTIONS, PAPER_TEMPLATES } from "../../constants/paperTemplates"
import { usePaperUiStore } from "../../store/paperUiStore"
import type { PaperSizeClass, PaperTemplateId } from "../../types/paperProfile"

export function PaperTemplateMenu({ variant = "inline" }: { variant?: "inline" | "sidebar" }) {
  const activeTemplateId = usePaperUiStore((s) => s.activeTemplateId)
  const activeSizeClass = usePaperUiStore((s) => s.activeSizeClass)
  const setTemplate = usePaperUiStore((s) => s.setTemplate)
  const setSizeClass = usePaperUiStore((s) => s.setSizeClass)

  const isSidebar = variant === "sidebar"

  return (
    <div
      className={
        isSidebar
          ? "paper-template-menu paper-template-menu--sidebar flex w-full flex-col gap-2.5"
          : "paper-template-menu flex flex-wrap items-center gap-2"
      }
    >
      <span
        className={
          isSidebar
            ? "text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--common-semidark-text-color)]"
            : "text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--common-dark-text-color)]"
        }
      >
        Paper
      </span>
      <span className="text-[0.6rem] uppercase tracking-wide text-[var(--common-semidark-text-color)]">
        single-page
      </span>
      <label className="sr-only" htmlFor="paper-template-select">
        Paper template
      </label>
      <select
        id="paper-template-select"
        className={
          isSidebar
            ? "w-full rounded-md border border-[var(--common-border-color)] bg-[var(--common-bg-color)] px-2 py-2 text-xs text-[var(--common-text-color)]"
            : "rounded border border-[var(--common-border-color)] bg-[var(--common-btn-bg-color)] px-2 py-1 text-xs text-[var(--common-text-color)]"
        }
        value={activeTemplateId}
        onChange={(e) => setTemplate(e.target.value as PaperTemplateId)}
      >
        {PAPER_TEMPLATES.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </select>
      <label className="sr-only" htmlFor="paper-size-select">
        Paper size
      </label>
      <select
        id="paper-size-select"
        className={
          isSidebar
            ? "w-full rounded-md border border-[var(--common-border-color)] bg-[var(--common-bg-color)] px-2 py-2 text-xs text-[var(--common-text-color)]"
            : "rounded border border-[var(--common-border-color)] bg-[var(--common-btn-bg-color)] px-2 py-1 text-xs text-[var(--common-text-color)]"
        }
        value={activeSizeClass}
        onChange={(e) => setSizeClass(e.target.value as PaperSizeClass)}
      >
        {PAPER_SIZE_OPTIONS.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

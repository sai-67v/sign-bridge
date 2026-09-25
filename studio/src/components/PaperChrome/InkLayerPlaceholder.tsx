export function InkLayerPlaceholder() {
  return (
    <div
      className="ink-layer-placeholder flex items-center justify-center gap-2 border-b border-dashed border-[var(--common-border-light-color)] bg-[var(--common-dark-bg-color)] px-2 py-1 text-center text-[0.7rem] text-[var(--common-dark-text-color)]"
      aria-hidden="true"
    >
      <span aria-hidden>✎</span>
      <span>Drawing layer — next step (ink will appear here)</span>
    </div>
  )
}

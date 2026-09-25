import { PAD_HOME_DUAL_PALETTE } from "./padHomeIconAccent"

type Props = {
  value: number
  onChange: (accentIndex: number) => void
  disabled?: boolean
  size?: "sm" | "md"
  label?: string
}

/** Eight dual-tone chips for library tile / folder color (indices match {@link PAD_HOME_DUAL_PALETTE}). */
export function PadTileAccentSwatches({
  value,
  onChange,
  disabled,
  size = "md",
  label = "Color",
}: Props) {
  const dim = size === "sm" ? "h-7 w-7" : "h-9 w-9"
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-[color:var(--common-semidark-text-color)]">{label}</span>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
        {PAD_HOME_DUAL_PALETTE.map((pair, i) => {
          const selected = (value % 8) === i
          return (
            <button
              key={pair.key}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={pair.key}
              disabled={disabled}
              className={`${dim} shrink-0 rounded-full border-2 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--common-primary-color,#6366f1)] focus-visible:ring-offset-2 disabled:opacity-50 ${
                selected ? "border-[color:var(--common-text-color)] scale-105" : "border-white/40 shadow-sm hover:scale-105"
              }`}
              style={{
                background: `linear-gradient(135deg, ${pair.primary}, ${pair.secondary})`,
              }}
              onClick={() => onChange(i)}
            />
          )
        })}
      </div>
    </div>
  )
}

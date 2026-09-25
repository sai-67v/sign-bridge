/**
 * Home / folder grid tile glyphs.
 *
 * Uses **Tabler Icons** (`react-icons/tb`) — MIT, stroke-based SVGs that scale cleanly.
 * Browse & swap: https://react-icons.github.io/react-icons/search/#q=folder (filter prefix **tb**).
 * Alternatives in the same package: `hi` (Heroicons), `md` (Material), etc.
 */
import type { IconBaseProps } from "react-icons/lib"
import {
  TbBook2,
  TbClipboardList,
  TbFileText,
  TbFolder,
  TbSchool,
} from "react-icons/tb"
import { cn } from "../../lib/utils"
import { padHomeDualColors, type PadHomeDualAccentIndex } from "./padHomeIconAccent"

export type PadHomeIconProps = Omit<IconBaseProps, "color"> & {
  /** 0–7: picks a dual-tone pair from {@link PAD_HOME_DUAL_PALETTE} */
  accentIndex?: PadHomeDualAccentIndex | number
}

/** Classroom / class — Tabler `TbSchool` (distinct from folder tiles on home). */
export function PadHomeIconClassroom({
  className,
  accentIndex = 0,
  strokeWidth = 1.5,
  ...rest
}: PadHomeIconProps) {
  const { primary, secondary } = padHomeDualColors(accentIndex)
  return (
    <span className={cn("relative inline-flex size-full max-h-full max-w-full items-center justify-center", className)}>
      <TbSchool
        aria-hidden
        className="absolute size-[92%] max-h-full max-w-full opacity-30"
        style={{ color: secondary }}
        strokeWidth={strokeWidth}
      />
      <TbSchool
        aria-hidden
        className="relative z-[1] size-[92%] max-h-full max-w-full"
        style={{ color: primary }}
        strokeWidth={strokeWidth}
        {...rest}
      />
    </span>
  )
}

/** Folder — Tabler `TbFolder` */
export function PadHomeIconFolder({
  className,
  accentIndex = 0,
  strokeWidth = 1.5,
  ...rest
}: PadHomeIconProps) {
  const { primary, secondary } = padHomeDualColors(accentIndex)
  return (
    <span className={cn("relative inline-flex size-full max-h-full max-w-full items-center justify-center", className)}>
      <TbFolder
        aria-hidden
        className="absolute size-[92%] max-h-full max-w-full opacity-30"
        style={{ color: secondary }}
        strokeWidth={strokeWidth}
      />
      <TbFolder
        aria-hidden
        className="relative z-[1] size-[92%] max-h-full max-w-full"
        style={{ color: primary }}
        strokeWidth={strokeWidth}
        {...rest}
      />
    </span>
  )
}

/** Notebook — Tabler `TbBook2` */
export function PadHomeIconNotebook({
  className,
  accentIndex = 0,
  strokeWidth = 1.5,
  ...rest
}: PadHomeIconProps) {
  const { primary, secondary } = padHomeDualColors(accentIndex)
  return (
    <span className={cn("relative inline-flex size-full max-h-full max-w-full items-center justify-center", className)}>
      <TbBook2
        aria-hidden
        className="absolute size-[92%] max-h-full max-w-full opacity-30"
        style={{ color: secondary }}
        strokeWidth={strokeWidth}
      />
      <TbBook2
        aria-hidden
        className="relative z-[1] size-[92%] max-h-full max-w-full"
        style={{ color: primary }}
        strokeWidth={strokeWidth}
        {...rest}
      />
    </span>
  )
}

/** Page — Tabler `TbFileText` */
export function PadHomeIconPage({
  className,
  accentIndex = 0,
  strokeWidth = 1.5,
  ...rest
}: PadHomeIconProps) {
  const { primary, secondary } = padHomeDualColors(accentIndex)
  return (
    <span className={cn("relative inline-flex size-full max-h-full max-w-full items-center justify-center", className)}>
      <TbFileText
        aria-hidden
        className="absolute size-[92%] max-h-full max-w-full opacity-30"
        style={{ color: secondary }}
        strokeWidth={strokeWidth}
      />
      <TbFileText
        aria-hidden
        className="relative z-[1] size-[92%] max-h-full max-w-full"
        style={{ color: primary }}
        strokeWidth={strokeWidth}
        {...rest}
      />
    </span>
  )
}

/** Worksheet — Tabler `TbClipboardList` */
export function PadHomeIconWorksheet({
  className,
  accentIndex = 0,
  strokeWidth = 1.5,
  ...rest
}: PadHomeIconProps) {
  const { primary, secondary } = padHomeDualColors(accentIndex)
  return (
    <span className={cn("relative inline-flex size-full max-h-full max-w-full items-center justify-center", className)}>
      <TbClipboardList
        aria-hidden
        className="absolute size-[92%] max-h-full max-w-full opacity-30"
        style={{ color: secondary }}
        strokeWidth={strokeWidth}
      />
      <TbClipboardList
        aria-hidden
        className="relative z-[1] size-[92%] max-h-full max-w-full"
        style={{ color: primary }}
        strokeWidth={strokeWidth}
        {...rest}
      />
    </span>
  )
}

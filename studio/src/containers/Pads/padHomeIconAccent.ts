/** Eight dual-tone accent pairs for pad home tiles (primary stroke + secondary accent). */
export const PAD_HOME_DUAL_PALETTE = [
  { key: "violet", primary: "#5b21b6", secondary: "#c4b5fd" },
  { key: "ocean", primary: "#0369a1", secondary: "#38bdf8" },
  { key: "forest", primary: "#047857", secondary: "#6ee7b7" },
  { key: "sunset", primary: "#c2410c", secondary: "#fdba74" },
  { key: "rose", primary: "#be123c", secondary: "#fda4af" },
  { key: "amber", primary: "#b45309", secondary: "#fcd34d" },
  { key: "indigo", primary: "#3730a3", secondary: "#a5b4fc" },
  { key: "teal", primary: "#0f766e", secondary: "#5eead4" },
] as const

export type PadHomeDualAccentIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7

/** Stable index 0–7 from an id (folder id, pad id, etc.). */
export function padHomeDualAccentFromId(seed: string): PadHomeDualAccentIndex {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 8) as PadHomeDualAccentIndex
}

export function padHomeDualColors(index: number) {
  return PAD_HOME_DUAL_PALETTE[index % PAD_HOME_DUAL_PALETTE.length]
}

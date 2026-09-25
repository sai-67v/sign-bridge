import { create } from "zustand"

export type OverlayKind =
  | null
  | "settings"
  | "submissions"
  | "notifications"
  | "classrooms"
  | "paper-settings"

interface OverlayState {
  kind: OverlayKind
  open: (kind: Exclude<OverlayKind, null>) => void
  close: () => void
}

export const useOverlayStore = create<OverlayState>((set) => ({
  kind: null,
  open: (kind) => set({ kind }),
  close: () => set({ kind: null }),
}))

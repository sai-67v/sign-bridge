import { create } from "zustand"
import type { Editor } from "@tiptap/react"

type PadEditorStore = {
  /** One TipTap editor per open note id (required for notebook stacks). */
  byId: Record<string, Editor>
  /** Pad whose TipTap last received focus — drives TypewriterDock in notebook stacks. */
  focusedTypingPadId: string | null
  setFocusedTypingPadId: (id: string | null) => void
  registerPadEditor: (noteId: string, editor: Editor | null) => void
  getEditor: (noteId: string) => Editor | null
}

export const usePadEditorStore = create<PadEditorStore>((set, get) => ({
  byId: {},
  focusedTypingPadId: null,
  setFocusedTypingPadId: (focusedTypingPadId) => set({ focusedTypingPadId }),
  registerPadEditor: (noteId, editor) =>
    set((s) => {
      const next = { ...s.byId }
      if (editor) next[noteId] = editor
      else delete next[noteId]
      const clearFocus = !editor && s.focusedTypingPadId === noteId
      return {
        byId: next,
        ...(clearFocus ? { focusedTypingPadId: null } : {}),
      }
    }),
  getEditor: (noteId) => {
    const e = get().byId[noteId] ?? null
    if (e?.isDestroyed) {
      set((s) => {
        const next = { ...s.byId }
        delete next[noteId]
        const clearFocus = s.focusedTypingPadId === noteId
        return {
          byId: next,
          ...(clearFocus ? { focusedTypingPadId: null } : {}),
        }
      })
      return null
    }
    return e
  },
}))

import { create } from "zustand"

type NotebookStackState = {
  /** Notebook page pad IDs in stack order (cover first). */
  orderedPageIds: string[]
  setOrderedPageIds: (ids: string[]) => void
}

export const useNotebookStackStore = create<NotebookStackState>((set) => ({
  orderedPageIds: [],
  setOrderedPageIds: (ids) => set({ orderedPageIds: ids }),
}))

import { create } from "zustand"
import { api, Note } from "../services/api"
import { getPadPersistenceUid, noteStoreStorageKey } from "../services/padClientStorage"

function emptyNotes(): Pick<NoteState, "notes" | "currentNote"> {
  return { notes: [], currentNote: null }
}

function loadPersistedForUid(uid: string): Pick<NoteState, "notes" | "currentNote"> {
  try {
    const raw = localStorage.getItem(noteStoreStorageKey(uid))
    if (!raw) return emptyNotes()
    const parsed = JSON.parse(raw) as { notes?: Note[]; currentNote?: Note | null }
    return { notes: parsed.notes ?? [], currentNote: parsed.currentNote ?? null }
  } catch {
    return emptyNotes()
  }
}

function persistPartial(state: Pick<NoteState, "notes" | "currentNote">) {
  const uid = getPadPersistenceUid()
  if (!uid) return
  try {
    localStorage.setItem(noteStoreStorageKey(uid), JSON.stringify(state))
  } catch {
    // ignore storage errors
  }
}

interface NoteState {
  notes: Note[]
  currentNote: Note | null
  loading: boolean

  rehydrateForUser: (uid: string | null) => void
  fetchNotes: (notebookId?: string | null, ownerUid?: string | null) => Promise<void>
  selectNote: (id: string) => Promise<void>
  createNote: (
    title: string,
    opts?: { notebookId?: string | null; folderId?: string; classId?: string | null },
  ) => Promise<void>
  updateNoteContent: (id: string, content: string) => Promise<void>
  updateLocalContent: (id: string, content: string) => void
  setCurrentNote: (note: Note) => void
  deleteNote: (id: string) => Promise<void>
}

export const useNoteStore = create<NoteState>((set, get) => ({
  ...emptyNotes(),
  loading: false,

  rehydrateForUser: (uid) => {
    if (!uid) {
      set({ ...emptyNotes(), loading: false })
      return
    }
    set({ ...loadPersistedForUid(uid), loading: false })
  },

  fetchNotes: async (notebookId?: string | null, ownerUid?: string | null) => {
    set({ loading: true })
    try {
      const notes = await api.getNotes(notebookId ?? undefined, ownerUid ?? undefined)
      set({ notes, loading: false })
      persistPartial({ notes, currentNote: get().currentNote })
    } catch (err) {
      console.error("fetchNotes failed:", err)
      set({ notes: [], loading: false })
    }
  },

  selectNote: async (id: string) => {
    try {
      const note = await api.getNote(id)
      set({ currentNote: note })
      persistPartial({ notes: get().notes, currentNote: note })
    } catch (err) {
      console.error("selectNote failed:", err)
      set({ currentNote: null })
    }
  },

  createNote: async (title, opts) => {
    const notebookId = opts?.notebookId
    const note = await api.createNote({
      title,
      content: "",
      ...(notebookId ? { notebookId } : {}),
      ...(opts?.folderId ? { folderId: opts.folderId } : {}),
      ...(opts?.classId ? { classId: opts.classId } : {}),
    })
    set((state) => ({ notes: [...state.notes, note], currentNote: note }))
    persistPartial({ notes: [...get().notes, note], currentNote: note })
  },

  updateNoteContent: async (id: string, content: string) => {
    const updated = await api.updateNote(id, { content })
    set((state) => ({
      notes: state.notes.map((n) => (n.id === id ? updated : n)),
      currentNote: state.currentNote?.id === id ? updated : state.currentNote,
    }))
    const st = get()
    persistPartial({ notes: st.notes, currentNote: st.currentNote })
  },

  updateLocalContent: (id: string, content: string) => {
    set((state) => {
      const updatedNote =
        state.currentNote?.id === id ? { ...state.currentNote, content } : null

      return {
        notes: state.notes.map((n) => (n.id === id ? { ...n, content } : n)),
        currentNote: updatedNote || state.currentNote,
      }
    })
    const st = get()
    persistPartial({ notes: st.notes, currentNote: st.currentNote })
  },

  setCurrentNote: (note: Note) => {
    set({ currentNote: note })
    persistPartial({ notes: get().notes, currentNote: note })
  },

  deleteNote: async (id: string) => {
    await api.deleteNote(id)
    set((state) => ({
      notes: state.notes.filter((n) => n.id !== id),
      currentNote: state.currentNote?.id === id ? null : state.currentNote,
    }))
    const st = get()
    persistPartial({ notes: st.notes, currentNote: st.currentNote })
  },
}))

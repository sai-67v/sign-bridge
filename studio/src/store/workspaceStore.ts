import { create } from "zustand"
import { getPadPersistenceUid, workspaceStorageKey } from "../services/padClientStorage"

export type WorkspaceFolder = { id: string; name: string; accentIndex?: number }

export type WorkspacePersisted = {
  sidebarCollapsed: boolean
  currentNotebookId: string | null
  lastNotebookId: string | null
  materialPaneOpen: boolean
  /** Flex-basis % for the material column on large layouts (22–45, persisted). */
  materialPaneBasisPercent: number
  selectedFolderId: string | null
  mediumFilter: "all" | "page" | "worksheet" | "flashcard"
  folders: WorkspaceFolder[]
}

const MIN_MATERIAL_BASIS_PCT = 22
const MAX_MATERIAL_BASIS_PCT = 45

/**
 * Old client-only ids from `createFolder` before Appwrite sync:
 * `folder-${Date.now().toString(36)}-${random.slice(2,6)}` — must not use a loose `startsWith("folder-")`
 * or real Appwrite/custom ids like `folder-mathe` get misclassified.
 */
const LEGACY_LOCAL_ONLY_FOLDER_ID_RE = /^folder-[0-9a-z]+-[0-9a-z]{4}$/i

export function isLegacyLocalOnlyFolderId(id: string): boolean {
  return LEGACY_LOCAL_ONLY_FOLDER_ID_RE.test(id)
}

export function clampMaterialPaneBasisPercent(n: number): number {
  if (!Number.isFinite(n)) return 30
  return Math.min(MAX_MATERIAL_BASIS_PCT, Math.max(MIN_MATERIAL_BASIS_PCT, Math.round(n)))
}

function defaultWorkspacePersisted(): WorkspacePersisted {
  return {
    sidebarCollapsed: true,
    currentNotebookId: null,
    lastNotebookId: null,
    materialPaneOpen: true,
    materialPaneBasisPercent: 30,
    selectedFolderId: null,
    mediumFilter: "all",
    folders: [],
  }
}

function parseWorkspacePersisted(raw: string | null): WorkspacePersisted {
  if (!raw) return defaultWorkspacePersisted()
  try {
    const p = JSON.parse(raw) as Partial<WorkspacePersisted>
    return {
      sidebarCollapsed: typeof p.sidebarCollapsed === "boolean" ? p.sidebarCollapsed : true,
      currentNotebookId: p.currentNotebookId ?? null,
      lastNotebookId: p.lastNotebookId ?? null,
      materialPaneOpen: typeof p.materialPaneOpen === "boolean" ? p.materialPaneOpen : true,
      materialPaneBasisPercent: clampMaterialPaneBasisPercent(
        typeof p.materialPaneBasisPercent === "number" ? p.materialPaneBasisPercent : 30
      ),
      selectedFolderId:
        typeof p.selectedFolderId === "string" && isLegacyLocalOnlyFolderId(p.selectedFolderId)
          ? null
          : (p.selectedFolderId ?? null),
      mediumFilter: (() => {
        const mf = (p as { mediumFilter?: string }).mediumFilter ?? "all"
        if (mf === "notebook") return "all"
        if (mf === "all" || mf === "page" || mf === "worksheet" || mf === "flashcard") {
          return mf
        }
        return "all"
      })(),
      folders: Array.isArray(p.folders)
        ? (p.folders as Partial<WorkspaceFolder>[])
            .map((f) => ({
              id: String(f?.id ?? ""),
              name: String(f?.name ?? ""),
              ...(typeof f?.accentIndex === "number" ? { accentIndex: f.accentIndex % 8 } : {}),
            }))
            .filter((f) => f.id && !isLegacyLocalOnlyFolderId(f.id))
        : [],
    }
  } catch {
    return defaultWorkspacePersisted()
  }
}

function writePersisted(s: WorkspacePersisted) {
  const uid = getPadPersistenceUid()
  if (!uid) return
  try {
    localStorage.setItem(workspaceStorageKey(uid), JSON.stringify(s))
  } catch {
    /* ignore */
  }
}

const initial = defaultWorkspacePersisted()

export interface WorkspaceStore extends WorkspacePersisted {
  /** When true, Home/library structure actions are blocked (e.g. US3 shared read-only notebook context). Not persisted — set by routing/share resolution later. */
  libraryStructureReadOnly: boolean
  setLibraryStructureReadOnly: (v: boolean) => void
  /** Load persisted workspace for this uid, or defaults when signed out. */
  rehydrateForUser: (uid: string | null) => void
  setSidebarCollapsed: (v: boolean) => void
  toggleSidebar: () => void
  setCurrentNotebookId: (id: string | null) => void
  setLastNotebookId: (id: string | null) => void
  setSelectedFolderId: (id: string | null) => void
  setMediumFilter: (filter: WorkspacePersisted["mediumFilter"]) => void
  createFolder: (name: string, accentIndex?: number) => string
  /** After Appwrite creates a folder, merge it into local workspace state and select it. */
  registerFolder: (folder: WorkspaceFolder) => string
  /** Drop pre-sync `folder-*` rows so they do not duplicate real Appwrite folders in the UI. */
  pruneLegacyClientFolders: () => void
  renameFolder: (id: string, name: string, accentIndex?: number) => void
  setMaterialPaneOpen: (v: boolean) => void
  toggleMaterialPane: () => void
  /** Updates flex basis %; defaults to persisting — pass `persist: false` while dragging. */
  setMaterialPaneBasisPercent: (pct: number, persist?: boolean) => void
  /** Remove workspace folder rows and selection that are not in this allowed id set (server + pad refs). */
  pruneWorkspaceFolderState: (allowedFolderIds: Set<string>) => void
}

function persistFrom(get: () => WorkspaceStore) {
  const st = get()
  writePersisted({
    sidebarCollapsed: st.sidebarCollapsed,
    currentNotebookId: st.currentNotebookId,
    lastNotebookId: st.lastNotebookId,
    materialPaneOpen: st.materialPaneOpen,
    materialPaneBasisPercent: st.materialPaneBasisPercent,
    selectedFolderId: st.selectedFolderId,
    mediumFilter: st.mediumFilter,
    folders: st.folders,
  })
}

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  ...initial,
  libraryStructureReadOnly: false,

  rehydrateForUser: (uid) => {
    if (!uid) {
      set({ ...defaultWorkspacePersisted(), libraryStructureReadOnly: false })
      return
    }
    try {
      const raw = localStorage.getItem(workspaceStorageKey(uid))
      set({
        ...parseWorkspacePersisted(raw),
        libraryStructureReadOnly: false,
      })
    } catch {
      set({ ...defaultWorkspacePersisted(), libraryStructureReadOnly: false })
    }
  },

  setLibraryStructureReadOnly: (libraryStructureReadOnly) => set({ libraryStructureReadOnly }),

  setSidebarCollapsed: (sidebarCollapsed) => {
    set({ sidebarCollapsed })
    persistFrom(get)
  },

  toggleSidebar: () => {
    set({ sidebarCollapsed: !get().sidebarCollapsed })
    persistFrom(get)
  },

  setCurrentNotebookId: (currentNotebookId) => {
    set((state) => ({
      currentNotebookId,
      lastNotebookId: currentNotebookId ? currentNotebookId : state.lastNotebookId,
    }))
    persistFrom(get)
  },

  setLastNotebookId: (lastNotebookId) => {
    set({ lastNotebookId })
    persistFrom(get)
  },

  setSelectedFolderId: (selectedFolderId) => {
    set({ selectedFolderId })
    persistFrom(get)
  },

  setMediumFilter: (mediumFilter) => {
    set({ mediumFilter })
    persistFrom(get)
  },

  createFolder: (name, accentIndex = 0) => {
    const id = `folder-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
    const ai = accentIndex % 8
    const nextFolder: WorkspaceFolder = { id, name: name.trim() || "Untitled folder", accentIndex: ai }
    set((state) => ({ folders: [nextFolder, ...state.folders], selectedFolderId: id }))
    persistFrom(get)
    return id
  },

  registerFolder: (folder) => {
    const ai = (folder.accentIndex ?? 0) % 8
    const next: WorkspaceFolder = {
      id: folder.id,
      name: folder.name.trim() || "Untitled folder",
      accentIndex: ai,
    }
    set((state) => {
      const idx = state.folders.findIndex((f) => f.id === next.id)
      const folders =
        idx >= 0
          ? state.folders.map((f, i) => (i === idx ? { ...f, ...next } : f))
          : [next, ...state.folders]
      return { folders, selectedFolderId: next.id }
    })
    persistFrom(get)
    return next.id
  },

  pruneLegacyClientFolders: () => {
    set((state) => {
      const folders = state.folders.filter((f) => !isLegacyLocalOnlyFolderId(f.id))
      const selectedFolderId =
        state.selectedFolderId && isLegacyLocalOnlyFolderId(state.selectedFolderId)
          ? null
          : state.selectedFolderId
      return { folders, selectedFolderId }
    })
    persistFrom(get)
  },

  renameFolder: (id, name, accentIndex) => {
    set((state) => {
      const nextName = name.trim()
      if (!nextName) return state
      const idx = state.folders.findIndex((f) => f.id === id)
      const accentPatch =
        accentIndex !== undefined ? { accentIndex: accentIndex % 8 } : {}
      if (idx >= 0) {
        return {
          folders: state.folders.map((f) =>
            f.id === id ? { ...f, name: nextName, ...accentPatch } : f
          ),
        }
      }
      // Folder IDs can come from persisted page data before local folder metadata exists.
      return {
        folders: [{ id, name: nextName, ...accentPatch }, ...state.folders],
      }
    })
    persistFrom(get)
  },

  setMaterialPaneOpen: (materialPaneOpen) => {
    set({ materialPaneOpen })
    persistFrom(get)
  },

  toggleMaterialPane: () => {
    set({ materialPaneOpen: !get().materialPaneOpen })
    persistFrom(get)
  },

  setMaterialPaneBasisPercent: (pct, persist = true) => {
    set({ materialPaneBasisPercent: clampMaterialPaneBasisPercent(pct) })
    if (persist) persistFrom(get)
  },

  pruneWorkspaceFolderState: (allowedFolderIds) => {
    set((state) => ({
      folders: state.folders.filter((f) => allowedFolderIds.has(f.id)),
      selectedFolderId:
        state.selectedFolderId && allowedFolderIds.has(state.selectedFolderId)
          ? state.selectedFolderId
          : null,
    }))
    persistFrom(get)
  },
}))

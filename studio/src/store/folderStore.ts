import { create } from 'zustand';
import type { IFolder } from '../types';
import { folderService } from '../services/folderService';

interface FolderStore {
  folders: IFolder[];
  activeFolderId: string | null;
  loading: boolean;
  fetchFolders: (ownerId: string) => Promise<void>;
  setActiveFolder: (id: string | null) => void;
  createFolder: (ownerId: string, data: Omit<IFolder, 'id' | 'ownerId' | '$createdAt'>) => Promise<IFolder>;
  updateFolder: (id: string, data: Partial<Pick<IFolder, 'name' | 'color' | 'parentFolderId' | 'classId' | 'folderKind'>>) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
}

export const useFolderStore = create<FolderStore>((set) => ({
  folders: [],
  activeFolderId: null,
  loading: false,

  fetchFolders: async (ownerId) => {
    set({ loading: true });
    try {
      const folders = await folderService.listFolders(ownerId);
      set({ folders, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  setActiveFolder: (id) => set({ activeFolderId: id }),

  createFolder: async (ownerId, data) => {
    const folder = await folderService.createFolder(ownerId, data);
    set(state => ({ folders: [...state.folders, folder] }));
    return folder;
  },

  updateFolder: async (id, data) => {
    const updated = await folderService.updateFolder(id, data);
    set(state => ({ folders: state.folders.map(f => f.id === id ? updated : f) }));
  },

  deleteFolder: async (id) => {
    await folderService.deleteFolder(id);
    set(state => ({ folders: state.folders.filter(f => f.id !== id) }));
  },
}));

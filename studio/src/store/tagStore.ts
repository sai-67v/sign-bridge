import { create } from 'zustand';
import type { ITag } from '../types';
import { tagService } from '../services/tagService';

interface TagStore {
  tags: ITag[];
  activeTagIds: string[];
  loading: boolean;
  fetchTags: (ownerId: string) => Promise<void>;
  toggleActiveTag: (id: string) => void;
  clearActiveTags: () => void;
  createTag: (ownerId: string, data: Omit<ITag, 'id' | 'ownerId'>) => Promise<ITag>;
  updateTag: (id: string, data: Partial<Pick<ITag, 'name' | 'color'>>) => Promise<void>;
  deleteTag: (id: string) => Promise<void>;
}

export const useTagStore = create<TagStore>((set) => ({
  tags: [],
  activeTagIds: [],
  loading: false,

  fetchTags: async (ownerId) => {
    set({ loading: true });
    try {
      const tags = await tagService.listTags(ownerId);
      set({ tags, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  toggleActiveTag: (id) =>
    set(state => ({
      activeTagIds: state.activeTagIds.includes(id)
        ? state.activeTagIds.filter(t => t !== id)
        : [...state.activeTagIds, id],
    })),

  clearActiveTags: () => set({ activeTagIds: [] }),

  createTag: async (ownerId, data) => {
    const tag = await tagService.createTag(ownerId, data);
    set(state => ({ tags: [...state.tags, tag] }));
    return tag;
  },

  updateTag: async (id, data) => {
    const updated = await tagService.updateTag(id, data);
    set(state => ({ tags: state.tags.map(t => t.id === id ? updated : t) }));
  },

  deleteTag: async (id) => {
    await tagService.deleteTag(id);
    set(state => ({ tags: state.tags.filter(t => t.id !== id) }));
  },
}));

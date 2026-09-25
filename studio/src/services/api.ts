import type { InkSnapshot, PaperProfile } from "../types/paperProfile";
import { isAppwriteConfigured } from "../config/appwriteEnv";

/** True when notes CRUD should use the Appwrite Web SDK (see `appwriteApi`). */
export const USE_APPWRITE = isAppwriteConfigured();

// Lazy load Appwrite API
let appwriteApiPromise: Promise<typeof import('./appwriteApi').appwriteApi | null> | null = null;
function getAppwriteApi() {
  if (!USE_APPWRITE) return null;
  if (!appwriteApiPromise) {
    appwriteApiPromise = import('./appwriteApi')
      .then(module => module.appwriteApi)
      .catch(error => {
        console.error('❌ Failed to load Appwrite API, falling back to backend:', error);
        return null;
      });
  }
  return appwriteApiPromise;
}

const API_BASE = (typeof process !== 'undefined' && process.env?.REACT_APP_CANISCLI_URL) || import.meta.env?.VITE_CANISCLI_URL || 'http://localhost:5001';

export interface WorksheetSection {
  id: string;
  type: 'locked' | 'editable';
  content: string;
}

/** Appwrite/backend: document removed vs already absent (404). */
export type DeleteNoteResult = 'deleted' | 'missing'

/** JSON policy on a pad (worksheet / class), stored in Appwrite as string. */
export type PadPolicies = {
  generativeAssist?: 'allowed' | 'disallowed';
};

export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  worksheetSections?: WorksheetSection[];
  studentAnswers?: Record<string, string>;
  // Per-user ownership & organisation
  ownerId?: string;
  uid?: string;
  padType?: 'note' | 'worksheet' | 'notebook' | 'flashcard';
  folderId?: string;
  notebookId?: string | null;
  tagIds?: string[];
  paperProfile?: PaperProfile;
  inkSnapshot?: InkSnapshot;
  /** Library home tile dual-tone palette index (0–7). */
  tileAccentIndex?: number;
  /** Optional: denormalized class id for fast queries. */
  classId?: string | null;
  padPolicies?: PadPolicies | null;
}

export const api = {
  // Notes CRUD
  async getNotes(notebookId?: string | null, ownerUid?: string | null, folderId?: string | null): Promise<Note[]> {
    const appwriteApi = await getAppwriteApi();
    if (appwriteApi) return appwriteApi.getNotes(notebookId, ownerUid, folderId);
    try {
      const params = new URLSearchParams();
      if (notebookId != null && notebookId !== "") params.set("notebookId", notebookId);
      if (folderId != null && folderId !== "") params.set("folderId", folderId);
      const q = params.toString() ? `?${params.toString()}` : "";
      const res = await fetch(`${API_BASE}/api/notes${q}`);
      if (!res.ok) throw new Error('Failed to fetch notes');
      const notes = await res.json();
      return (Array.isArray(notes) ? notes : []).sort((a, b) => Number(b?.updatedAt || 0) - Number(a?.updatedAt || 0));
    } catch (e) {
      console.warn('Backend not reachable for notes. Set VITE_APPWRITE_* in .env or run a notes API at VITE_CANISCLI_URL.', e);
      return [];
    }
  },

  async getNote(id: string): Promise<Note> {
    if (!id || id === 'null' || id === 'undefined') {
      throw new Error('Invalid note id');
    }
    const appwriteApi = await getAppwriteApi();
    if (appwriteApi) return appwriteApi.getNote(id);
    try {
      const res = await fetch(`${API_BASE}/api/notes/${id}`);
      if (!res.ok) throw new Error('Failed to fetch note');
      return res.json();
    } catch (e) {
      console.warn('Backend not reachable for getNote.', e);
      throw e;
    }
  },

  async createNote(note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>): Promise<Note> {
    const appwriteApi = await getAppwriteApi();
    if (appwriteApi) {
      return appwriteApi.createNote(note);
    }
    const payload = {
      ...note,
      notebookId: note.padType === "note" && !note.notebookId ? null : note.notebookId,
    };
    const res = await fetch(`${API_BASE}/api/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to create note');
    return res.json();
  },

  async updateNote(id: string, updates: Partial<Note>): Promise<Note> {
    const appwriteApi = await getAppwriteApi();
    if (appwriteApi) {
      return appwriteApi.updateNote(id, updates);
    }
    const payload = {
      ...updates,
      notebookId: updates.padType === "note" && !updates.notebookId ? null : updates.notebookId,
    };
    const res = await fetch(`${API_BASE}/api/notes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to update note');
    return res.json();
  },

  async deleteNote(id: string): Promise<DeleteNoteResult> {
    const appwriteApi = await getAppwriteApi();
    if (appwriteApi) {
      return appwriteApi.deleteNote(id);
    }
    const res = await fetch(`${API_BASE}/api/notes/${id}`, { method: 'DELETE' });
    if (res.status === 404) return 'missing';
    if (!res.ok) throw new Error('Failed to delete note');
    return 'deleted';
  }
};

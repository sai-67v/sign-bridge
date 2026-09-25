import { ID, Permission, Query, Role } from 'appwrite';
import { databases } from '../libs/appwrite';
import { getAppwriteErrorCode, withAppwriteRetry } from './appwriteRetry';
import type { Note, DeleteNoteResult } from './api';
import type { InkSnapshot, PaperProfile } from '../types/paperProfile';

import { APPWRITE_DATABASE_ID } from "../config/appwriteEnv";

const DATABASE_ID = APPWRITE_DATABASE_ID;
const NOTES_COLLECTION = 'notes';

/** Appwrite default list limit is 25; page until an empty response (don't stop on partial pages — some installs cap below requested limit). */
const NOTES_LIST_PAGE_SIZE = 100;
const NOTES_LIST_MAX_PAGES = 2_000;

async function listAllNoteDocuments(filterQueries: string[]): Promise<unknown[]> {
  const all: unknown[] = [];
  let lastId: string | undefined;
  for (let page = 0; page < NOTES_LIST_MAX_PAGES; page++) {
    const q = [...filterQueries, Query.orderAsc('$id'), Query.limit(NOTES_LIST_PAGE_SIZE)];
    if (lastId) {
      q.push(Query.cursorAfter(lastId));
    }
    const response = await withAppwriteRetry(() =>
      databases.listDocuments(DATABASE_ID, NOTES_COLLECTION, q)
    );
    const docs = response.documents || [];
    if (docs.length === 0) {
      break;
    }
    const batchLastId = docs[docs.length - 1]?.$id as string | undefined;
    if (batchLastId && batchLastId === lastId) {
      break;
    }
    all.push(...docs);
    lastId = batchLastId;
    if (!lastId) {
      break;
    }
  }
  return all;
}

let currentUserId: string | null = null;
export function setAppwriteUserId(userId: string | null): void {
  currentUserId = userId;
}
function getUserId(): string | null {
  return currentUserId;
}

function docToNote(doc: any): Note {
  const parseDate = (date: any): number => {
    if (!date) return Date.now();
    if (typeof date === 'number') return date;
    if (typeof date === 'string') {
      const parsed = new Date(date).getTime();
      return isNaN(parsed) ? Date.now() : parsed;
    }
    return Date.now();
  };

  return {
    id: doc.$id,
    title: doc.title || '',
    content: doc.content || '',
    createdAt: parseDate(doc.createdAt ?? doc.$createdAt),
    updatedAt: parseDate(doc.updatedAt ?? doc.$updatedAt),
    ownerId: doc.ownerId || doc.uid,
    uid: doc.uid || doc.ownerId,
    padType: doc.padType || 'note',
    folderId: doc.folderId,
    notebookId: doc.notebookId ?? null,
    tagIds: doc.tags || doc.tagIds,
    worksheetSections: doc.worksheetSections
      ? (typeof doc.worksheetSections === 'string'
          ? JSON.parse(doc.worksheetSections)
          : doc.worksheetSections)
      : undefined,
    studentAnswers: doc.studentAnswers
      ? (typeof doc.studentAnswers === 'string'
          ? JSON.parse(doc.studentAnswers)
          : doc.studentAnswers)
      : undefined,
    paperProfile: doc.paperProfile
      ? (typeof doc.paperProfile === 'string'
          ? JSON.parse(doc.paperProfile) as PaperProfile
          : doc.paperProfile as PaperProfile)
      : undefined,
    inkSnapshot: doc.inkSnapshot
      ? (typeof doc.inkSnapshot === 'string'
          ? JSON.parse(doc.inkSnapshot) as InkSnapshot
          : doc.inkSnapshot as InkSnapshot)
      : undefined,
    tileAccentIndex:
      typeof doc.tileAccentIndex === 'number'
        ? Math.max(0, Math.min(7, Math.floor(doc.tileAccentIndex)))
        : undefined,
    classId: doc.classId ?? undefined,
    padPolicies: (() => {
      if (doc.padPolicies == null || doc.padPolicies === '') return undefined;
      try {
        return typeof doc.padPolicies === 'string'
          ? (JSON.parse(doc.padPolicies) as Note['padPolicies'])
          : (doc.padPolicies as Note['padPolicies']);
      } catch {
        return undefined;
      }
    })(),
  };
}

function notePermissions(uid: string) {
  return [
    Permission.read(Role.user(uid)),
    Permission.update(Role.user(uid)),
    Permission.delete(Role.user(uid)),
  ];
}

export const appwriteApi = {
  async getNotes(
    notebookIdFilter?: string | null,
    ownerUidOverride?: string | null,
    folderIdFilter?: string | null
  ): Promise<Note[]> {
    try {
      const uid = ownerUidOverride ?? getUserId();
      if (!uid || String(uid).trim() === '') {
        console.warn('getNotes: skipped — no owner uid (session not ready or missing override).');
        return [];
      }
      const queries: string[] = [
        Query.or([Query.equal('ownerId', uid), Query.equal('uid', uid)]),
      ];
      if (notebookIdFilter) {
        queries.push(Query.equal('notebookId', notebookIdFilter));
      }
      if (folderIdFilter) {
        queries.push(Query.equal('folderId', folderIdFilter));
      }
      const docs = await listAllNoteDocuments(queries);
      return docs.map((d) => docToNote(d));
    } catch (error) {
      console.error('Failed to fetch notes from Appwrite:', error);
      return [];
    }
  },

  async getNote(id: string): Promise<Note> {
    if (!id || id === 'null' || id === 'undefined') {
      throw new Error('Invalid note id');
    }
    const doc = await databases.getDocument(DATABASE_ID, NOTES_COLLECTION, id);
    return docToNote(doc);
  },

  async createNote(note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>): Promise<Note> {
    const uid = note.uid ?? note.ownerId ?? getUserId();
    const now = Date.now();
    const payload: Record<string, unknown> = {
      title: note.title,
      content: note.content || '',
      createdAt: now,
      updatedAt: now,
      padType: note.padType || 'note',
      folderId: note.folderId || null,
      notebookId: note.notebookId ?? null,
      tags: note.tagIds || [],
      worksheetSections: note.worksheetSections ? JSON.stringify(note.worksheetSections) : null,
      studentAnswers: note.studentAnswers ? JSON.stringify(note.studentAnswers) : null,
      paperProfile: note.paperProfile ? JSON.stringify(note.paperProfile) : null,
      inkSnapshot: note.inkSnapshot ? JSON.stringify(note.inkSnapshot) : null,
      // Omit tileAccentIndex until the Appwrite `notes` collection defines it;
      // create with unknown attrs returns 400.
    };
    if (uid) {
      payload.uid = uid;
      payload.ownerId = uid;
    }
    if (note.classId !== undefined && note.classId !== null && note.classId !== '') {
      payload.classId = note.classId;
    }
    const permissions = uid ? notePermissions(uid) : undefined;
    const doc = await databases.createDocument(
      DATABASE_ID,
      NOTES_COLLECTION,
      ID.unique(),
      payload,
      permissions,
    );
    return docToNote(doc);
  },

  async updateNote(id: string, updates: Partial<Note>): Promise<Note> {
    const updateData: Record<string, unknown> = { updatedAt: Date.now() };

    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.content !== undefined) updateData.content = updates.content;
    if (updates.padType !== undefined) updateData.padType = updates.padType;
    if (updates.folderId !== undefined) updateData.folderId = updates.folderId;
    if (updates.notebookId !== undefined) updateData.notebookId = updates.notebookId;
    if (updates.tagIds !== undefined) updateData.tags = updates.tagIds;
    if (updates.worksheetSections !== undefined) {
      updateData.worksheetSections = updates.worksheetSections
        ? JSON.stringify(updates.worksheetSections)
        : null;
    }
    if (updates.studentAnswers !== undefined) {
      updateData.studentAnswers = updates.studentAnswers
        ? JSON.stringify(updates.studentAnswers)
        : null;
    }
    if (updates.paperProfile !== undefined) {
      updateData.paperProfile = updates.paperProfile ? JSON.stringify(updates.paperProfile) : null;
    }
    if (updates.inkSnapshot !== undefined) {
      updateData.inkSnapshot = updates.inkSnapshot ? JSON.stringify(updates.inkSnapshot) : null;
    }
    if (updates.tileAccentIndex !== undefined) {
      updateData.tileAccentIndex =
        typeof updates.tileAccentIndex === "number"
          ? Math.max(0, Math.min(7, Math.floor(updates.tileAccentIndex)))
          : null;
    }
    if (updates.classId !== undefined) {
      updateData.classId = updates.classId === '' ? null : updates.classId;
    }

    const doc = await databases.updateDocument(DATABASE_ID, NOTES_COLLECTION, id, updateData);
    return docToNote(doc);
  },

  async deleteNote(id: string): Promise<DeleteNoteResult> {
    try {
      await withAppwriteRetry(() =>
        databases.deleteDocument(DATABASE_ID, NOTES_COLLECTION, id)
      );
    } catch (e: unknown) {
      if (getAppwriteErrorCode(e) === 404) return 'missing'
      throw e
    }
    return 'deleted'
  },

  canPlaceWorksheetInClassroom(params: { role?: string | null; folderId?: string | null; classroomFolderId?: string | null }): boolean {
    const role = (params.role || "").toLowerCase()
    const isTeacher = role === "teacher" || role === "admin"
    if (!isTeacher) return false
    if (!params.classroomFolderId) return true
    return params.folderId === params.classroomFolderId
  },
};

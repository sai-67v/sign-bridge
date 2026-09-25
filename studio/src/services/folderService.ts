import { ID, Permission, Query, Role } from 'appwrite';
import { APPWRITE_DATABASE_ID } from '../config/appwriteEnv';
import { databases } from '../libs/appwrite';
import type { IClassroom, IFolder } from '../types';
import { classroomService } from './classroomService';

const DB = APPWRITE_DATABASE_ID;
const COL = 'folders';

function docToFolder(doc: any): IFolder {
  return {
    id: doc.$id,
    ownerId: doc.ownerId || doc.uid,
    name: doc.name,
    color: doc.color,
    parentFolderId: doc.parentId || doc.parentFolderId,
    classId: doc.classId ?? undefined,
    folderKind: doc.folderKind ?? undefined,
    $createdAt: doc.$createdAt,
  };
}

export const folderService = {
  async createFolder(ownerId: string, data: Omit<IFolder, 'id' | 'ownerId' | '$createdAt'>): Promise<IFolder> {
    const payload: Record<string, unknown> = {
      name: data.name,
      color: data.color || null,
      parentId: data.parentFolderId || null,
      ownerId,
      uid: ownerId,
    };
    if (data.classId !== undefined && data.classId !== null) payload.classId = data.classId;
    if (data.folderKind !== undefined && data.folderKind !== null) payload.folderKind = data.folderKind;
    const doc = await databases.createDocument(DB, COL, ID.unique(), payload, [
      Permission.read(Role.user(ownerId)),
      Permission.update(Role.user(ownerId)),
      Permission.delete(Role.user(ownerId)),
    ]);
    return docToFolder(doc);
  },

  async listFolders(ownerId: string): Promise<IFolder[]> {
    const res = await databases.listDocuments(DB, COL, [
      Query.or([Query.equal('ownerId', ownerId), Query.equal('uid', ownerId)]),
      Query.limit(200),
    ]);
    return res.documents.map(docToFolder);
  },

  async updateFolder(id: string, data: Partial<Pick<IFolder, 'name' | 'color' | 'parentFolderId' | 'classId' | 'folderKind'>>): Promise<IFolder> {
    const payload: Record<string, unknown> = {};
    if (data.name !== undefined) payload.name = data.name;
    if (data.color !== undefined) payload.color = data.color;
    if (data.parentFolderId !== undefined) payload.parentId = data.parentFolderId;
    if (data.classId !== undefined) payload.classId = data.classId;
    if (data.folderKind !== undefined) payload.folderKind = data.folderKind;
    const doc = await databases.updateDocument(DB, COL, id, payload);
    return docToFolder(doc);
  },

  async deleteFolder(id: string): Promise<void> {
    await databases.deleteDocument(DB, COL, id);
  },

  /**
   * True when `folderId` is `ancestorId` or any parent walk reaches `ancestorId`.
   * Used to gate class materials to pads whose `folderId` lives under the class library root.
   */
  async isFolderDescendantOf(
    ownerId: string,
    folderId: string | null | undefined,
    ancestorId: string | null | undefined,
  ): Promise<boolean> {
    if (!folderId || !ancestorId) return false;
    if (folderId === ancestorId) return true;
    const folders = await folderService.listFolders(ownerId);
    const byId = new Map(folders.map((f) => [f.id, f] as const));
    let cur: string | undefined = folderId;
    const seen = new Set<string>();
    for (let depth = 0; depth < 200 && cur; depth++) {
      if (cur === ancestorId) return true;
      if (seen.has(cur)) break;
      seen.add(cur);
      const f = byId.get(cur);
      cur = f?.parentFolderId || undefined;
      if (!cur) break;
    }
    return false;
  },

  /**
   * Top-level `class_workspace` folder for this class in **this user's** library (teacher root or student mirror).
   * Used to gate class-materials shelf without comparing student paths to the teacher's `classrooms.rootFolderId`.
   */
  async findClassWorkspaceRootFolderId(ownerId: string, classroomId: string): Promise<string | null> {
    const folders = await folderService.listFolders(ownerId);
    const root = folders.find(
      (f) =>
        f.classId === classroomId &&
        f.folderKind === 'class_workspace' &&
        (f.parentFolderId === undefined || f.parentFolderId === null),
    );
    return root?.id ?? null;
  },

  /**
   * Ensures a single `folderKind=materials` folder **inside** the class workspace (`rootFolderId` = class workspace root).
   * Returns null if the classroom has no root folder yet.
   */
  async ensureClassMaterialsFolder(ownerId: string, classroom: IClassroom): Promise<IFolder | null> {
    if (!classroom.rootFolderId) return null;
    const folders = await folderService.listFolders(ownerId);
    const existing = folders.find(
      (f) =>
        f.parentFolderId === classroom.rootFolderId &&
        f.folderKind === 'materials' &&
        f.classId === classroom.id
    );
    if (existing) {
      if (existing.id !== classroom.materialsFolderId) {
        try {
          await classroomService.updateClassroom(classroom.id, { materialsFolderId: existing.id });
        } catch {
          /* optional column not deployed */
        }
      }
      return existing;
    }
    const created = await folderService.createFolder(ownerId, {
      name: 'Materials',
      parentFolderId: classroom.rootFolderId,
      classId: classroom.id,
      folderKind: 'materials',
    });
    try {
      await classroomService.updateClassroom(classroom.id, { materialsFolderId: created.id });
    } catch {
      /* optional column not deployed */
    }
    return created;
  },

  /**
   * **Worksheets** folder inside the class workspace (`rootFolderId`), sibling to **Materials**.
   * Requires `classroom.rootFolderId` (call {@link classroomService.ensureClassWorkspaceIfNeeded} first).
   */
  async ensureClassWorksheetsFolder(ownerId: string, classroom: IClassroom): Promise<IFolder | null> {
    if (!classroom.rootFolderId) return null;
    const folders = await folderService.listFolders(ownerId);
    const existing = folders.find(
      (f) =>
        f.parentFolderId === classroom.rootFolderId &&
        f.classId === classroom.id &&
        f.name.trim().toLowerCase() === "worksheets"
    );
    if (existing) return existing;
    return folderService.createFolder(ownerId, {
      name: "Worksheets",
      parentFolderId: classroom.rootFolderId,
      classId: classroom.id,
      folderKind: "general",
    });
  },
};

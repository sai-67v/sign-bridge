import { ID, Permission, Query, Role } from 'appwrite';
import { APPWRITE_DATABASE_ID } from '../config/appwriteEnv';
import { databases } from '../libs/appwrite';
import type { ITag } from '../types';

const DB = APPWRITE_DATABASE_ID;
const COL = 'tags';

function docToTag(doc: any): ITag {
  return {
    id: doc.$id,
    ownerId: doc.ownerId || doc.uid,
    name: doc.name || doc.title,
    color: doc.color,
  };
}

export const tagService = {
  async createTag(ownerId: string, data: Omit<ITag, 'id' | 'ownerId'>): Promise<ITag> {
    const doc = await databases.createDocument(DB, COL, ID.unique(), {
      name: data.name,
      title: data.name,
      color: data.color || null,
      ownerId,
      uid: ownerId,
    }, [
      Permission.read(Role.user(ownerId)),
      Permission.update(Role.user(ownerId)),
      Permission.delete(Role.user(ownerId)),
    ]);
    return docToTag(doc);
  },

  async listTags(ownerId: string): Promise<ITag[]> {
    const res = await databases.listDocuments(DB, COL, [
      Query.or([Query.equal('ownerId', ownerId), Query.equal('uid', ownerId)]),
      Query.limit(200),
    ]);
    return res.documents.map(docToTag);
  },

  async updateTag(id: string, data: Partial<Pick<ITag, 'name' | 'color'>>): Promise<ITag> {
    const payload: Record<string, unknown> = {};
    if (data.name !== undefined) { payload.name = data.name; payload.title = data.name; }
    if (data.color !== undefined) payload.color = data.color;
    const doc = await databases.updateDocument(DB, COL, id, payload);
    return docToTag(doc);
  },

  async deleteTag(id: string): Promise<void> {
    await databases.deleteDocument(DB, COL, id);
  },
};

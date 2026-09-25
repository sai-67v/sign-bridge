import { ID, Permission, Query, Role } from 'appwrite';
import { APPWRITE_DATABASE_ID } from '../config/appwriteEnv';
import { databases } from '../libs/appwrite';
import type { ISchool } from '../types';

const DB = APPWRITE_DATABASE_ID;
const COL = 'schools';

function docToSchool(doc: any): ISchool {
  return {
    id: doc.$id,
    name: doc.name,
    adminId: doc.adminId,
    address: doc.address,
    city: doc.city,
    country: doc.country,
    logoFileId: doc.logoFileId,
    $createdAt: doc.$createdAt,
  };
}

export const schoolService = {
  async createSchool(adminId: string, data: Omit<ISchool, 'id' | 'adminId' | '$createdAt'>): Promise<ISchool> {
    const doc = await databases.createDocument(DB, COL, ID.unique(), {
      ...data,
      adminId,
    }, [
      Permission.read(Role.users()),
      Permission.update(Role.user(adminId)),
      Permission.delete(Role.user(adminId)),
    ]);
    return docToSchool(doc);
  },

  async getSchool(id: string): Promise<ISchool> {
    const doc = await databases.getDocument(DB, COL, id);
    return docToSchool(doc);
  },

  async listSchools(): Promise<ISchool[]> {
    const res = await databases.listDocuments(DB, COL, [Query.limit(100)]);
    return res.documents.map(docToSchool);
  },

  async searchSchools(query: string): Promise<ISchool[]> {
    const res = await databases.listDocuments(DB, COL, [
      Query.search('name', query),
      Query.limit(20),
    ]);
    return res.documents.map(docToSchool);
  },

  async updateSchool(id: string, adminId: string, data: Partial<Omit<ISchool, 'id' | 'adminId'>>): Promise<ISchool> {
    const doc = await databases.updateDocument(DB, COL, id, data);
    return docToSchool(doc);
  },

  async deleteSchool(id: string): Promise<void> {
    await databases.deleteDocument(DB, COL, id);
  },
};

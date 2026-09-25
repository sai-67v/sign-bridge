import { ID, Permission, Query, Role } from "appwrite"
import { APPWRITE_DATABASE_ID } from "../config/appwriteEnv"
import { databases } from "../libs/appwrite"

const DB = APPWRITE_DATABASE_ID
const COL = "page_materials"

export interface IPageMaterial {
  id: string
  noteId: string
  materialId: string
  pageStart: number
  pageEnd: number
}

function docToPin(doc: Record<string, unknown>): IPageMaterial {
  return {
    id: String(doc.$id),
    noteId: String(doc.noteId || ""),
    materialId: String(doc.materialId || ""),
    pageStart: typeof doc.pageStart === "number" ? doc.pageStart : parseInt(String(doc.pageStart || "1"), 10) || 1,
    pageEnd: typeof doc.pageEnd === "number" ? doc.pageEnd : parseInt(String(doc.pageEnd || "1"), 10) || 1,
  }
}

function permissions(uid: string) {
  return [
    Permission.read(Role.user(uid)),
    Permission.update(Role.user(uid)),
    Permission.delete(Role.user(uid)),
  ]
}

export const pageMaterialService = {
  async getForNote(noteId: string): Promise<IPageMaterial | null> {
    const res = await databases.listDocuments(DB, COL, [Query.equal("noteId", noteId), Query.limit(1)])
    if (!res.documents.length) return null
    return docToPin(res.documents[0] as Record<string, unknown>)
  },

  async upsertForNote(
    ownerId: string,
    noteId: string,
    materialId: string,
    pageStart: number,
    pageEnd: number
  ): Promise<IPageMaterial> {
    const existing = await pageMaterialService.getForNote(noteId)
    const payload = {
      noteId,
      materialId,
      pageStart,
      pageEnd,
      ownerId,
      uid: ownerId,
    }
    if (existing) {
      const doc = await databases.updateDocument(DB, COL, existing.id, {
        materialId,
        pageStart,
        pageEnd,
      })
      return docToPin(doc as Record<string, unknown>)
    }
    const doc = await databases.createDocument(DB, COL, ID.unique(), payload, permissions(ownerId))
    return docToPin(doc as Record<string, unknown>)
  },

  async deleteForNote(noteId: string): Promise<void> {
    const existing = await pageMaterialService.getForNote(noteId)
    if (existing) {
      await databases.deleteDocument(DB, COL, existing.id)
    }
  },
}

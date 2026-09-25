import { ID, Permission, Query, Role } from "appwrite"
import { APPWRITE_DATABASE_ID } from "../config/appwriteEnv"
import { databases } from "../libs/appwrite"
import { getAppwriteErrorCode, withAppwriteRetry } from "./appwriteRetry"

const DB = APPWRITE_DATABASE_ID
const COL = "notebooks"

export interface INotebook {
  id: string
  ownerId: string
  name: string
  color: string | null
  isInbox: boolean
  defaultMaterialId: string | null
  folderId: string | null
  coverTitle?: string | null
  lastAppendCursor?: string | null
}

function docToNotebook(doc: Record<string, unknown>): INotebook {
  return {
    id: String(doc.$id),
    ownerId: String(doc.ownerId || doc.uid || ""),
    name: String(doc.name || ""),
    color: doc.color != null ? String(doc.color) : null,
    isInbox: !!doc.isInbox,
    defaultMaterialId: doc.defaultMaterialId != null ? String(doc.defaultMaterialId) : null,
    folderId: doc.folderId != null ? String(doc.folderId) : null,
    coverTitle: doc.coverTitle != null ? String(doc.coverTitle) : null,
    lastAppendCursor: doc.lastAppendCursor != null ? String(doc.lastAppendCursor) : null,
  }
}

function permissions(uid: string) {
  return [
    Permission.read(Role.user(uid)),
    Permission.update(Role.user(uid)),
    Permission.delete(Role.user(uid)),
  ]
}

export const notebookService = {
  /** Lists notebooks owned by **ownerId** (ownerId/uid match only). See `specs/003-paper-notebooks-e2e/contracts/notebook-share.md` for future shared notebooks. */
  async listNotebooks(ownerId: string): Promise<INotebook[]> {
    const res = await databases.listDocuments(DB, COL, [
      Query.or([Query.equal("ownerId", ownerId), Query.equal("uid", ownerId)]),
      Query.limit(100),
    ])
    return res.documents.map((d) => docToNotebook(d as Record<string, unknown>))
  },

  async createNotebook(
    ownerId: string,
    data: { name: string; color?: string | null; folderId?: string | null }
  ): Promise<INotebook> {
    // NOTE: coverTitle / lastAppendCursor are intentionally NOT sent.
    // The Appwrite `notebooks` collection does not declare these attributes
    // and including them yields 400 "Unknown attribute". The notebook's
    // cover title is now taken from the first page's title at render time.
    const doc = await databases.createDocument(DB, COL, ID.unique(), {
      name: data.name,
      color: data.color ?? null,
      folderId: data.folderId ?? null,
      ownerId,
      uid: ownerId,
      isInbox: false,
      defaultMaterialId: null,
    }, permissions(ownerId))
    return docToNotebook(doc as Record<string, unknown>)
  },

  async ensureInboxNotebook(ownerId: string): Promise<string | null> {
    const existing = await databases.listDocuments(DB, COL, [
      Query.or([Query.equal("ownerId", ownerId), Query.equal("uid", ownerId)]),
      Query.equal("isInbox", true),
      Query.limit(1),
    ])
    if (existing.documents.length > 0) {
      return existing.documents[0].$id
    }
    const doc = await databases.createDocument(DB, COL, ID.unique(), {
      name: "Inbox",
      color: null,
      ownerId,
      uid: ownerId,
      isInbox: true,
      defaultMaterialId: null,
    }, permissions(ownerId))
    return doc.$id
  },

  async deleteNotebook(notebookId: string): Promise<void> {
    try {
      await withAppwriteRetry(() => databases.deleteDocument(DB, COL, notebookId))
    } catch (e: unknown) {
      if (getAppwriteErrorCode(e) === 404) return
      throw e
    }
  },

  async updateNotebookMetadata(
    _notebookId: string,
    _updates: { coverTitle?: string | null }
  ): Promise<void> {
    // The Appwrite `notebooks` collection does not declare coverTitle or
    // lastAppendCursor attributes. Persisting these is a no-op until the
    // schema is migrated; the notebook cover title is derived from the
    // first page's title at render time, which keeps the UX consistent
    // without requiring a backend change.
    return
  },
}

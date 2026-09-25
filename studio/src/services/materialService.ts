import { ID, Permission, Query, Role } from "appwrite"
import { configurePdfWorker } from "../lib/pdfBootstrap"
import {
  APPWRITE_DATABASE_ID,
  APPWRITE_ENDPOINT,
  APPWRITE_PROJECT_ID,
  APPWRITE_BUCKET_MATERIALS,
} from "../config/appwriteEnv"
import { databases, storage } from "../libs/appwrite"

const DB = APPWRITE_DATABASE_ID
const COL = "materials"
export const MATERIALS_BUCKET = APPWRITE_BUCKET_MATERIALS || "materials"

export interface IMaterial {
  id: string
  ownerId: string
  notebookId: string
  fileId: string
  title: string
  pageCount: number
  mime: string
  /** When set, material is scoped to a class materials folder (see `folders.folderKind === 'materials'`). */
  classFolderId?: string | null
}

function docToMaterial(doc: Record<string, unknown>): IMaterial {
  const cf = doc.classFolderId
  return {
    id: String(doc.$id),
    ownerId: String(doc.ownerId || doc.uid || ""),
    notebookId: String(doc.notebookId || ""),
    fileId: String(doc.fileId || ""),
    title: String(doc.title || ""),
    pageCount: typeof doc.pageCount === "number" ? doc.pageCount : parseInt(String(doc.pageCount || "0"), 10) || 0,
    mime: String(doc.mime || "application/pdf"),
    ...(cf !== undefined && cf !== null && cf !== "" ? { classFolderId: String(cf) } : { classFolderId: null }),
  }
}

function permissionsPrivate(uid: string) {
  return [
    Permission.read(Role.user(uid)),
    Permission.update(Role.user(uid)),
    Permission.delete(Role.user(uid)),
  ]
}

/** Owner can edit; any authenticated user can read (class PDFs in shared workflow — still scoped by `classFolderId` in app logic). */
function permissionsClassMaterial(uid: string) {
  return [
    ...permissionsPrivate(uid),
    Permission.read(Role.users()),
  ]
}

async function countPdfPages(file: File): Promise<number> {
  const pdfjs = await import("pdfjs-dist")
  configurePdfWorker(pdfjs)
  const url = URL.createObjectURL(file)
  try {
    const pdf = await pdfjs.getDocument({ url }).promise
    return pdf.numPages
  } finally {
    URL.revokeObjectURL(url)
  }
}

export const materialService = {
  getFileViewUrl(fileId: string): string {
    if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID) {
      throw new Error("Appwrite is not configured (set VITE_APPWRITE_ENDPOINT and VITE_APPWRITE_PROJECT_ID)")
    }
    return `${APPWRITE_ENDPOINT.replace(/\/$/, "")}/storage/buckets/${MATERIALS_BUCKET}/files/${fileId}/view?project=${APPWRITE_PROJECT_ID}`
  },

  async fetchPdfBytes(fileId: string, signal?: AbortSignal): Promise<ArrayBuffer> {
    const url = materialService.getFileViewUrl(fileId)
    let last: unknown
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(url, { credentials: "include", mode: "cors", signal })
        if (!res.ok) throw new Error(`PDF fetch failed (${res.status})`)
        return await res.arrayBuffer()
      } catch (e) {
        last = e
        if (signal?.aborted) throw e
        if (attempt < 2) await new Promise((r) => setTimeout(r, 350 * (attempt + 1)))
      }
    }
    throw last instanceof Error ? last : new Error("PDF fetch failed")
  },

  async uploadMaterial(
    ownerId: string,
    notebookId: string,
    file: File,
    title?: string,
    opts?: { classFolderId?: string | null }
  ): Promise<IMaterial> {
    if (opts?.classFolderId !== undefined && opts?.classFolderId !== null) {
      const cf = String(opts.classFolderId).trim()
      if (!cf) {
        throw new Error("classFolderId is required for class-scoped uploads and cannot be empty.")
      }
    }
    const pageCount = await countPdfPages(file)
    const fileId = ID.unique()
    const perms = opts?.classFolderId ? permissionsClassMaterial(ownerId) : permissionsPrivate(ownerId)
    await storage.createFile(MATERIALS_BUCKET, fileId, file, perms)

    const payload: Record<string, unknown> = {
      ownerId,
      uid: ownerId,
      notebookId,
      fileId,
      title: title || file.name.replace(/\.pdf$/i, "") || "Material",
      pageCount,
      mime: file.type || "application/pdf",
    }
    if (opts?.classFolderId) {
      payload.classFolderId = opts.classFolderId
    }

    const doc = await databases.createDocument(DB, COL, ID.unique(), payload, perms)

    return docToMaterial(doc as Record<string, unknown>)
  },

  /**
   * Notebook-wide materials that are not tied to a class materials folder (no cross-class leakage in default lists).
   */
  async listForNotebook(ownerId: string, notebookId: string): Promise<IMaterial[]> {
    const res = await databases.listDocuments(DB, COL, [
      Query.or([Query.equal("ownerId", ownerId), Query.equal("uid", ownerId)]),
      Query.equal("notebookId", notebookId),
      Query.isNull("classFolderId"),
      Query.limit(100),
    ])
    return res.documents.map((d) => docToMaterial(d as Record<string, unknown>))
  },

  /**
   * List PDF rows pinned to a class materials folder. Uses `classFolderId` only so teachers and students
   * see the same shelf (notebookId differs between accounts).
   */
  async listMaterialsInClassFolder(classFolderId: string): Promise<IMaterial[]> {
    const res = await databases.listDocuments(DB, COL, [
      Query.equal("classFolderId", classFolderId),
      Query.limit(100),
    ])
    return res.documents.map((d) => docToMaterial(d as Record<string, unknown>))
  },

  /**
   * When `classrooms.materialsFolderId` is still null (e.g. Console row never updated), infer the shared
   * materials folder id from the teacher's **class-scoped** uploads (`classFolderId` set + `read("users")` on doc).
   * Dominant `classFolderId` wins (works for single-class; multi-class teachers should open Class → Materials once
   * so `materialsFolderId` is persisted).
   */
  inferSharedClassMaterialsFolderId(teacherId: string): Promise<string | null> {
    return databases
      .listDocuments(DB, COL, [Query.equal("ownerId", teacherId), Query.orderDesc("$createdAt"), Query.limit(120)])
      .then((res) => {
        const isSharedClassPdf = (doc: unknown) => {
          const d = doc as Record<string, unknown>
          const cf = d.classFolderId
          if (cf === undefined || cf === null || String(cf).trim() === "") return false
          const perms = d.$permissions
          const arr = Array.isArray(perms) ? perms : []
          return arr.some((p) => {
            const s = String(p)
            return s.includes("read(\"users\")") || s.includes("read('users')")
          })
        }
        const shared = res.documents.filter(isSharedClassPdf)
        if (!shared.length) return null
        const counts = new Map<string, number>()
        for (const d of shared) {
          const cf = String((d as Record<string, unknown>).classFolderId).trim()
          counts.set(cf, (counts.get(cf) ?? 0) + 1)
        }
        let best: string | null = null
        let bestN = 0
        for (const [cf, n] of counts) {
          if (n > bestN) {
            best = cf
            bestN = n
          }
        }
        return best
      })
      .catch(() => null)
  },

  async deleteMaterial(id: string, fileId: string): Promise<void> {
    await databases.deleteDocument(DB, COL, id)
    try {
      await storage.deleteFile(MATERIALS_BUCKET, fileId)
    } catch {
      /* file may already be gone */
    }
  },

  async getMaterial(id: string): Promise<IMaterial | null> {
    try {
      const doc = await databases.getDocument(DB, COL, id)
      return docToMaterial(doc as Record<string, unknown>)
    } catch {
      return null
    }
  },
}

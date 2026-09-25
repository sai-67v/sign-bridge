import { ID, Permission, Query, Role } from "appwrite"
import { APPWRITE_DATABASE_ID } from "../config/appwriteEnv"
import { databases } from "../libs/appwrite"
import type { IPadAiUsageEvent, PadAiUsageEventKind } from "../types"

const DB = APPWRITE_DATABASE_ID

/** Deploy `pad_ai_usage_events` collection in your Appwrite database before expecting writes to succeed. */
const COL = "pad_ai_usage_events"

function docToEvent(doc: Record<string, unknown>): IPadAiUsageEvent {
  return {
    id: String(doc.$id),
    schoolId: String(doc.schoolId ?? ""),
    classroomId: String(doc.classroomId ?? ""),
    noteId: String(doc.noteId ?? ""),
    userId: String(doc.userId ?? ""),
    eventKind: (String(doc.eventKind || "ai_chat") as PadAiUsageEventKind) || "ai_chat",
    metadata: doc.metadata != null ? String(doc.metadata) : null,
    $createdAt: doc.$createdAt != null ? String(doc.$createdAt) : undefined,
  }
}

export const aiUsageEventService = {
  async record(input: {
    schoolId: string
    classroomId: string
    noteId: string
    userId: string
    eventKind: PadAiUsageEventKind
    metadata?: Record<string, unknown> | null
  }): Promise<void> {
    const meta =
      input.metadata && Object.keys(input.metadata).length > 0 ? JSON.stringify(input.metadata) : null
    try {
      await databases.createDocument(
        DB,
        COL,
        ID.unique(),
        {
          schoolId: input.schoolId,
          classroomId: input.classroomId,
          noteId: input.noteId,
          userId: input.userId,
          eventKind: input.eventKind,
          metadata: meta,
        },
        [
          /** Teachers list by `classroomId`; tighten to row-level teacher-only when Feature 008 RLS lands. */
          Permission.read(Role.users()),
          Permission.update(Role.user(input.userId)),
          Permission.delete(Role.user(input.userId)),
        ],
      )
    } catch (e) {
      console.warn("[pad_ai_usage_events] record skipped (table missing or permission):", e)
    }
  },

  async listByClassroom(classroomId: string, limit = 100): Promise<IPadAiUsageEvent[]> {
    try {
      const res = await databases.listDocuments(DB, COL, [
        Query.equal("classroomId", classroomId),
        Query.orderDesc("$createdAt"),
        Query.limit(limit),
      ])
      return res.documents.map((d) => docToEvent(d as Record<string, unknown>))
    } catch {
      return []
    }
  },
}

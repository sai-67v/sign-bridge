import { api } from "./api"
import { classroomService } from "./classroomService"
import { folderService } from "./folderService"
import { createEmptyWorksheet } from "../utils/WorksheetParser"

const inflight = new Map<string, Promise<string>>()

/**
 * Provisions class library root + Materials + Worksheets folder if needed, creates a new worksheet note,
 * and returns its id. Dedupes concurrent calls per owner+class (React Strict Mode / double mount).
 */
export function startNewClassroomWorksheet(ownerId: string, classroomId: string): Promise<string> {
  const key = `${ownerId}:${classroomId}`
  const existing = inflight.get(key)
  if (existing) return existing

  const promise = (async () => {
    let classroom = await classroomService.getClassroom(classroomId)
    classroom = await classroomService.ensureClassWorkspaceIfNeeded(ownerId, classroom)
    const worksheetsFolder = await folderService.ensureClassWorksheetsFolder(ownerId, classroom)
    if (!worksheetsFolder?.id) {
      throw new Error("Could not resolve a Worksheets folder for this class.")
    }
    const note = await api.createNote({
      title: "New Worksheet",
      content: createEmptyWorksheet(),
      padType: "worksheet",
      folderId: worksheetsFolder.id,
      classId: classroom.id,
      uid: ownerId,
      ownerId,
    })
    if (!note?.id) throw new Error("Worksheet was not created.")
    return note.id
  })().finally(() => {
    inflight.delete(key)
  })

  inflight.set(key, promise)
  return promise
}

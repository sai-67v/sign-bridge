import { api, Note } from "./api"
import { Timestamp } from "../libs/firebase"
import { IPadQuery } from "../store/pad"
import { message } from "../components/message"
import { Rules } from "../containers/PadActions/PadShareModal/types"
import type { InkSnapshot, PaperProfile } from "../types/paperProfile"
import type { MediumType } from "../types/paperProfile"
import { notebookService } from "./notebookService"
import { deleteAllImageInOnePad } from "./files"
import { parseWorksheetMarkdown, worksheetElementsToSections } from "../utils/WorksheetParser"
import { currentPadIdStorageKey, getPadPersistenceUid } from "./padClientStorage"

// Mock types that were previously from firebase/firestore
type QueryDocumentSnapshot = any;
type Unsubscribe = () => void;

export type PadType = 'note' | 'worksheet' | 'notebook' | 'flashcard';
export type PadMediumType = MediumType

export interface IWorksheetSection {
  id: string;
  type: 'locked' | 'editable';
  content: string;
}

export interface IPad {
  id: string
  uid: string
  title: string
  shortDesc?: string
  searchId?: string
  cover?: string
  content: string
  cipherContent: string
  sharedContent: string
  createdAt: Timestamp
  updatedAt: Timestamp
  important: boolean
  shared: ISharedPad
  // New fields for worksheets
  padType?: PadType
  worksheetSections?: IWorksheetSection[]
  notebookId?: string | null
  folderId?: string | null
  // Student answers - stored server-side for cross-browser persistence
  studentAnswers?: Record<string, string>
  paperProfile?: PaperProfile
  inkSnapshot?: InkSnapshot
  mediumType?: PadMediumType
  /** Denormalized class id when synced from backend. */
  classId?: string | null
  /** Library home tile palette index (0–7); persisted on note when backend supports it. */
  tileAccentIndex?: number
}

export interface FolderMediumItem {
  id: string
  folderId: string | null
  notebookId: string | null
  ownerId: string
  updatedAt: number
  title: string
  mediumType: PadMediumType
}

/** True when the note is tied to a notebook (non-empty id). Handles stray "" from imports/API. */
export function notebookIdPresent(notebookId: unknown): boolean {
  if (notebookId == null) return false
  return String(notebookId).trim() !== ""
}

export function resolvePadMediumType(note: Pick<Note, "padType" | "notebookId">): PadMediumType {
  if (note.padType === "worksheet") return "worksheet"
  if (note.padType === "flashcard") return "flashcard"
  // Retired multi-page notebook product type: show as paper in library/filter UI.
  if (note.padType === "notebook") return "page"
  if (notebookIdPresent(note.notebookId)) return "page"
  return "page"
}

export function getPadMediumType(p: Pick<IPad, "mediumType" | "padType" | "notebookId">): PadMediumType {
  return p.mediumType ?? resolvePadMediumType({ padType: p.padType, notebookId: p.notebookId })
}

/**
 * Home / folder grid tile: notebook appears under a folder if the `notebooks` row has that folderId
 * or any of its pages (non-worksheet) has that folderId on the note document.
 * Standalone pages and worksheets use only their own folderId.
 */
export function padLibraryTileBelongsToFolder(
  tile: IPad,
  folderId: string,
  allPads: IPad[],
  notebookFolderByNotebookId?: ReadonlyMap<string, string | null> | null
): boolean {
  if (tile.padType === "worksheet") {
    return tile.folderId === folderId
  }
  if (notebookIdPresent(tile.notebookId)) {
    const nid = tile.notebookId as string
    const fromNotebookDoc = notebookFolderByNotebookId?.get(nid)
    if (fromNotebookDoc != null && String(fromNotebookDoc).trim() !== "" && fromNotebookDoc === folderId) {
      return true
    }
    return allPads.some(
      (q) =>
        q.padType !== "worksheet" &&
        notebookIdPresent(q.notebookId) &&
        q.notebookId === nid &&
        q.folderId === folderId
    )
  }
  return tile.folderId === folderId
}

/** `rootId` plus every folder whose `parentFolderId` chain reaches `rootId` (fixed-point, bounded). */
export function collectDescendantFolderIds(
  rootId: string,
  folders: ReadonlyArray<{ id: string; parentFolderId?: string | null }>,
): Set<string> {
  const out = new Set<string>([rootId])
  let changed = true
  for (let guard = 0; guard < 200 && changed; guard++) {
    changed = false
    for (const f of folders) {
      const pid = f.parentFolderId
      if (pid == null || String(pid).trim() === "") continue
      if (out.has(pid) && !out.has(f.id)) {
        out.add(f.id)
        changed = true
      }
    }
  }
  return out
}

/** True if the library tile belongs to `rootFolderId` or any folder nested under it (e.g. class workspace → Materials / Worksheets). */
export function padLibraryTileBelongsToFolderSubtree(
  tile: IPad,
  rootFolderId: string,
  allPads: IPad[],
  folders: ReadonlyArray<{ id: string; parentFolderId?: string | null }>,
  notebookFolderByNotebookId?: ReadonlyMap<string, string | null> | null,
): boolean {
  for (const fid of collectDescendantFolderIds(rootFolderId, folders)) {
    if (padLibraryTileBelongsToFolder(tile, fid, allPads, notebookFolderByNotebookId)) return true
  }
  return false
}

/** All folder ids under a class: roots where `folder.classId` matches plus descendants. */
export function collectFolderIdsForClassroom(
  classroomId: string,
  folders: Array<{ id: string; parentFolderId?: string; classId?: string | null }>,
): Set<string> {
  const roots = new Set<string>()
  for (const f of folders) {
    if (f.classId === classroomId) roots.add(f.id)
  }
  const out = new Set(roots)
  let changed = true
  while (changed) {
    changed = false
    for (const f of folders) {
      const pid = f.parentFolderId
      if (pid && out.has(pid) && !out.has(f.id)) {
        out.add(f.id)
        changed = true
      }
    }
  }
  return out
}

/** When a classroom is selected in the library, keep pads tied to that class or its folder subtree. */
export function padVisibleForClassroomFilter(
  pad: IPad,
  classroomId: string | null | undefined,
  allowedFolderIds: Set<string>,
  allPads: IPad[],
  notebookFolderByNotebookId: ReadonlyMap<string, string | null>,
): boolean {
  if (!classroomId) return true
  if (pad.classId === classroomId) return true
  if (allowedFolderIds.size === 0) return false
  for (const fid of allowedFolderIds) {
    if (padLibraryTileBelongsToFolder(pad, fid, allPads, notebookFolderByNotebookId)) return true
  }
  return false
}

/** Folder strip counts: increment once per tile per folder the tile touches. */
export function folderIdsTouchingLibraryTile(
  tile: IPad,
  allPads: IPad[],
  notebookFolderByNotebookId?: ReadonlyMap<string, string | null> | null
): Set<string> {
  const s = new Set<string>()
  if (tile.padType === "worksheet") {
    if (tile.folderId) s.add(tile.folderId)
    return s
  }
  if (notebookIdPresent(tile.notebookId)) {
    const nid = tile.notebookId as string
    const fromNotebookDoc = notebookFolderByNotebookId?.get(nid)
    if (fromNotebookDoc != null && String(fromNotebookDoc).trim() !== "") {
      s.add(String(fromNotebookDoc))
    }
    for (const q of allPads) {
      if (
        q.padType !== "worksheet" &&
        notebookIdPresent(q.notebookId) &&
        q.notebookId === nid &&
        q.folderId
      ) {
        s.add(q.folderId)
      }
    }
    return s
  }
  if (tile.folderId) s.add(tile.folderId)
  return s
}

export function toFolderMediumItem(pad: IPad): FolderMediumItem {
  const mediumType = getPadMediumType(pad)
  return {
    id: pad.id,
    folderId: pad.folderId ?? null,
    notebookId: pad.notebookId ?? null,
    ownerId: String(pad.uid ?? "local-user-123"),
    updatedAt: pad.updatedAt.toMillis(),
    title: pad.title || "Untitled",
    mediumType,
  }
}

/**
 * `Timestamp` is a class instance — JSON-serializing an `IPad` to localStorage
 * and reading it back yields a plain `{seconds, nanoseconds}` object that has
 * lost its prototype, so `.toMillis()` blows up. Rehydrate before reuse.
 */
export function rehydrateTimestamp(value: unknown): Timestamp {
  if (value instanceof Timestamp) return value
  if (value && typeof value === "object") {
    const v = value as { seconds?: number; nanoseconds?: number }
    if (typeof v.seconds === "number") {
      return new Timestamp(v.seconds, typeof v.nanoseconds === "number" ? v.nanoseconds : 0)
    }
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return Timestamp.fromMillis(value)
  }
  return Timestamp.now()
}

export function rehydrateIPad<T extends Partial<IPad> | null | undefined>(pad: T): T {
  if (!pad) return pad
  const next = pad as IPad
  return {
    ...next,
    createdAt: rehydrateTimestamp(next.createdAt),
    updatedAt: rehydrateTimestamp(next.updatedAt),
  } as T
}

/** Safe accessor used wherever a stored or rehydrated pad's timestamp may have lost its prototype. */
export function padCreatedAtMs(pad: Pick<IPad, "createdAt">): number {
  return rehydrateTimestamp(pad.createdAt).toMillis()
}

/**
 * Library/home grid: one tile per note document (legacy notebook pages each appear as their own tile).
 * Notebook grouping was retired from the product surface—sort by most recently updated.
 */
export function libraryPadsOneTilePerNotebook(pads: IPad[]): IPad[] {
  return [...pads].sort((a, b) => b.updatedAt.toMillis() - a.updatedAt.toMillis())
}

interface IUpdatedPad {
  id: string
  title?: string
  searchId?: string
  cover?: string
  updatedAt?: Timestamp
  tileAccentIndex?: number
}

export interface IUserShared {
  fullname: string
  email: string
  photoURL: string
  isEdit: boolean
}

export interface ISharedPad {
  sharedUsers: IUserShared[],
  viewedUsers: string[],
  editedUsers: string[] | string,
  accessLevel: Rules,
}

export const defaultShared: ISharedPad = {
  sharedUsers: [],
  viewedUsers: [],
  editedUsers: [],
  accessLevel: Rules.None,
}

const PAD_TILE_ACCENT_LS = "pad_tile_accent_v1"

function readTileAccentLs(noteId: string): number | undefined {
  try {
    const raw = localStorage.getItem(PAD_TILE_ACCENT_LS)
    if (!raw) return undefined
    const m = JSON.parse(raw) as Record<string, unknown>
    const v = m[noteId]
    if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, Math.min(7, Math.floor(v)))
  } catch {
    /* ignore */
  }
  return undefined
}

function writeTileAccentLs(noteId: string, idx: number) {
  try {
    const raw = localStorage.getItem(PAD_TILE_ACCENT_LS)
    const m = raw ? (JSON.parse(raw) as Record<string, number>) : {}
    m[noteId] = Math.max(0, Math.min(7, Math.floor(idx)))
    localStorage.setItem(PAD_TILE_ACCENT_LS, JSON.stringify(m))
  } catch {
    /* ignore */
  }
}

const mapNoteToPad = (note: Note, sessionUid?: string): IPad => {
  const uidStr = String(note.ownerId ?? note.uid ?? sessionUid ?? "local-user-123")
  return {
    id: note.id,
    uid: uidStr,
    title: note.title,
    content: note.content,
    // Defaults for missing backend fields
    shortDesc: "",
    searchId: "",
    cover: "",
    cipherContent: "",
    sharedContent: "",
    createdAt: new Timestamp(note.createdAt / 1000, 0),
    updatedAt: new Timestamp(note.updatedAt / 1000, 0),
    important: false, // Not supported by backend yet
    shared: defaultShared,
    // Worksheet data from backend
    padType: note.padType,
    worksheetSections: note.worksheetSections,
    notebookId: note.notebookId ?? null,
    folderId: note.folderId ?? null,
    // Student answers from server
    studentAnswers: note.studentAnswers,
    paperProfile: note.paperProfile,
    inkSnapshot: note.inkSnapshot,
    mediumType: resolvePadMediumType(note),
    tileAccentIndex: (() => {
      if (typeof note.tileAccentIndex === "number") {
        return Math.max(0, Math.min(7, Math.floor(note.tileAccentIndex)))
      }
      return readTileAccentLs(note.id)
    })(),
    classId: note.classId ?? null,
  };
};

/**
 * Save current editting pad
 */
export const saveCurrentPad = (id: string) => {
  const uid = getPadPersistenceUid()
  if (!uid) return
  try {
    localStorage.setItem(currentPadIdStorageKey(uid), id)
  } catch {
    /* ignore */
  }
}

export const getPadsByUidQuery = async (
  uid: string,
  queries: IPadQuery
): Promise<{
  lastDoc: QueryDocumentSnapshot | null
  data: IPad[]
}> => {
  try {
    const notes = await api.getNotes(undefined, uid);
    let pads = notes.map((n) => mapNoteToPad(n, uid));

    // "Recently" usually means sort by updated
    if (queries.recently) {
      pads.sort((a, b) => b.updatedAt.toMillis() - a.updatedAt.toMillis());
    } else {
      pads.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
    }

    // Mock pagination
    return {
      lastDoc: null,
      data: pads
    };
  } catch (err) {
    console.error(err);
    return { lastDoc: null, data: [] };
  }
}

export const getPadsByUid = async (uid: string): Promise<IPad[] | null> => {
  try {
    const notes = await api.getNotes(undefined, uid);
    return notes.map((n) => mapNoteToPad(n, uid));
  } catch (error) {
    console.log(error)
    return null
  }
}

export const getPadById = async (id: string): Promise<IPad | null> => {
  if (!id || id === 'null' || id === 'undefined') return null;
  try {
    const note = await api.getNote(id);
    return mapNoteToPad(note);
  } catch (error) {
    console.log(error)
    return null
  }
}

export const watchPadById = (
  id: string,
  cb: (err: boolean, data?: IPad) => void
): Unsubscribe => {
  // Polling fallback since we don't have real-time sockets yet
  let active = true;

  const poll = async () => {
    if (!active) return;
    try {
      const pad = await getPadById(id);
      if (pad) cb(false, pad);
      else cb(true);
    } catch (e) {
      cb(true);
    }
  };

  poll(); // Initial fetch
  const interval = setInterval(poll, 5000); // Poll every 5s

  return () => {
    active = false;
    clearInterval(interval);
  }
}

export const addPad = async ({
  uid,
  title,
  shortDesc,
  notebookId,
  folderId,
  padType,
}: Partial<IPad> & { notebookId?: string | null }) => {
  try {
    const uidStr = uid != null && String(uid).trim() !== "" ? String(uid).trim() : undefined
    const folderTrim =
      folderId != null && String(folderId).trim() !== "" ? String(folderId).trim() : undefined
    let classId: string | undefined
    if (uidStr && folderTrim) {
      const { classroomService } = await import("./classroomService")
      const cid = await classroomService.resolveClassIdForFolder(uidStr, folderTrim)
      if (cid) classId = cid
    }
    const note = await api.createNote({
      title: title || 'Untitled',
      content: '',
      padType: padType ?? 'note',
      ...(uidStr ? { uid: uidStr, ownerId: uidStr } : {}),
      ...(notebookId ? { notebookId } : {}),
      ...(folderTrim ? { folderId: folderTrim } : {}),
      ...(classId ? { classId } : {}),
    });
    return note.id;
  } catch (error) {
    console.error("addPad failed", error)
    return null
  }
}

/** `deleted` = row removed; `missing` = already gone (e.g. second delete); `failed` = error. */
export type DelPadResult = 'deleted' | 'missing' | 'failed'

export const delPad = async (id: string): Promise<DelPadResult> => {
  try {
    const r = await api.deleteNote(id)
    return r === 'deleted' ? 'deleted' : 'missing'
  } catch (error) {
    console.log(error)
    return 'failed'
  }
}

export const quickAddPad = async (uid: string) => {
  try {
    const uidStr = uid != null && String(uid).trim() !== "" ? String(uid).trim() : undefined
    const note = await api.createNote({
      title: "Untitled",
      content: "",
      ...(uidStr ? { uid: uidStr, ownerId: uidStr } : {}),
    });
    return note.id
  } catch (error) {
    return null
  }
}

/** Pace bulk note deletes to avoid hammering Appwrite Cloud before backoff kicks in. */
const BULK_DELETE_NOTE_PACE_MS = 100

/** Deletes every note for the owner, associated notebook rows, and pad images. Irreversible. */
export async function deleteAllPadsForOwner(ownerId: string): Promise<{
  deletedNotes: number
  alreadyMissingNotes: number
  failedNotes: number
}> {
  const pads = await getPadsByUid(ownerId)
  if (!pads?.length) return { deletedNotes: 0, alreadyMissingNotes: 0, failedNotes: 0 }

  const notebookIds = new Set<string>()
  for (const p of pads) {
    if (p.notebookId && p.padType !== "worksheet") {
      notebookIds.add(String(p.notebookId))
    }
  }

  let deletedNotes = 0
  const deletedNoteIds: string[] = []
  const failedNoteIds: string[] = []
  const alreadyMissingNoteIds: string[] = []
  for (let i = 0; i < pads.length; i++) {
    const p = pads[i]
    await deleteAllImageInOnePad(p.id).catch(() => {
      /* storage may be unavailable */
    })
    const outcome = await delPad(p.id)
    if (outcome === 'deleted') {
      deletedNotes += 1
      deletedNoteIds.push(p.id)
    } else if (outcome === 'failed') {
      failedNoteIds.push(p.id)
    } else {
      alreadyMissingNoteIds.push(p.id)
    }
    if (i < pads.length - 1) {
      await new Promise((r) => setTimeout(r, BULK_DELETE_NOTE_PACE_MS))
    }
  }

  /** Only delete notebook rows that still exist — avoids 404 noise for stale note→notebook refs. */
  let notebookIdsStillPresent: Set<string> | null = null
  try {
    const remaining = await notebookService.listNotebooks(ownerId)
    notebookIdsStillPresent = new Set(remaining.map((n) => n.id))
  } catch {
    notebookIdsStillPresent = null
  }

  const notebookIdList = [...notebookIds]
  const stillPresent = notebookIdsStillPresent
  const notebooksToDelete =
    stillPresent === null ? notebookIdList : notebookIdList.filter((nid) => stillPresent.has(nid))
  const skippedNotebookIds =
    stillPresent === null
      ? []
      : notebookIdList.filter((nid) => !stillPresent.has(nid))

  const deletedNotebookIds: string[] = []
  const failedNotebookIds: string[] = []

  for (let i = 0; i < notebooksToDelete.length; i++) {
    const nid = notebooksToDelete[i]
    try {
      await notebookService.deleteNotebook(nid)
      deletedNotebookIds.push(nid)
    } catch (err: unknown) {
      failedNotebookIds.push(nid)
      console.warn("deleteAllPadsForOwner: deleteNotebook", nid, err)
    }
    if (i < notebooksToDelete.length - 1) {
      await new Promise((r) => setTimeout(r, BULK_DELETE_NOTE_PACE_MS))
    }
  }

  console.log("[PAD] deleteAllPadsForOwner", {
    ownerId,
    attemptedNotes: pads.length,
    deletedNoteCount: deletedNotes,
    deletedNoteIds,
    alreadyMissingNoteIds,
    failedNoteIds,
    notebookIdsReferencedOnNotes: notebookIdList,
    skippedNotebookIdsNotOnServer: skippedNotebookIds,
    deletedNotebookIds,
    failedNotebookIds,
  })

  return {
    deletedNotes,
    alreadyMissingNotes: alreadyMissingNoteIds.length,
    failedNotes: failedNoteIds.length,
  }
}

/** Persists rich-text body to Appwrite — invoked from {@link PadEditor} debounce (ED-01, ED-06). */
export const updatePad = async ({
  id,
  content,
  cipherContent,
}: {
  id: string
  content: string
  cipherContent: string
}) => {
  await api.updateNote(id, { content });
}

export const updatePadMetadata = async ({
  id,
  title,
  searchId,
  cover,
  tileAccentIndex,
}: IUpdatedPad) => {
  const updates: Record<string, unknown> = {}
  if (title !== undefined) updates.title = title
  if (tileAccentIndex !== undefined) {
    const clamped = Math.max(0, Math.min(7, Math.floor(tileAccentIndex)))
    updates.tileAccentIndex = clamped
    writeTileAccentLs(id, clamped)
  }

  if (Object.keys(updates).length > 0) {
    // Optimistically notify listeners before the async call so consumers
    // (TopBar tabs, PadNavigation, PadInfo) update immediately and don't get
    // overwritten by stale polling data or the isEditing-reset effect.
    window.dispatchEvent(
      new CustomEvent('pad_metadata_changed', { detail: { id, ...updates } })
    );
    await api.updateNote(id, updates as Partial<Note>)
  }
}

export const updateNotebookCoverTitleIfFirstPage = async (pad: IPad, title: string) => {
  if (!pad.notebookId) return
  const pages = await api.getNotes(pad.notebookId)
  const firstPage = [...pages].sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0))[0]
  if (firstPage?.id !== pad.id) return
  await notebookService.updateNotebookMetadata(pad.notebookId, { coverTitle: title })
}

// Update worksheet sections for a pad (persisted on server)
export const updatePadWorksheetSections = async (id: string, sections: IWorksheetSection[]) => {
  await api.updateNote(id, { worksheetSections: sections } as any);
}

/** Persist structural snapshot (task + field ids/order) from markdown body — see US4 / worksheet-markers.md. */
export const syncWorksheetStructureFromContent = async (padId: string, content: string) => {
  const parsed = parseWorksheetMarkdown(content);
  if (!parsed.isWorksheet) return;
  const sections = worksheetElementsToSections(parsed.elements);
  await updatePadWorksheetSections(padId, sections);
};

// Update student answers for a worksheet (persisted on server for cross-browser)
export const updateStudentAnswers = async (id: string, answers: Record<string, string>) => {
  await api.updateNote(id, { studentAnswers: answers } as any);
}

export const updatePadPaperProfile = async (id: string, paperProfile: PaperProfile) => {
  await api.updateNote(id, { paperProfile });
}

export const updatePadInkSnapshot = async (id: string, inkSnapshot: InkSnapshot) => {
  await api.updateNote(id, { inkSnapshot });
}

type TReturnedWatchPad = {
  last: QueryDocumentSnapshot | null
  data: IPad[]
}
type IWatchDataCallback = (err: boolean, data: TReturnedWatchPad) => void

export const watchPads = (
  queries: IPadQuery,
  cb: IWatchDataCallback
): Unsubscribe | null => {
  let active = true;

  const poll = async () => {
    if (!active) return;
    try {
      const result = await getPadsByUidQuery("local-user", queries);
      cb(false, { last: null, data: result.data });
    } catch (e) {
      cb(true, { last: null, data: [] });
    }
  };

  poll();
  // Poll less frequently for lists
  const interval = setInterval(poll, 10000);

  return () => {
    active = false;
    clearInterval(interval);
  }
}

export const setImportant = async (id: string) => {
  // Not implemented in backend yet
  message.success("Important toggled (Local mocking - not persisted)");
}

export const setShared = async (reqShared: ISharedPad, id: string, contentPad?: string) => {
  // Not implemented in backend yet
  console.log("Setting shared (mock)", reqShared);
}

export const duplicatePad = async (id: string): Promise<string | null> => {
  try {
    const pad = await getPadById(id);
    if (!pad) return null;

    const note = await api.createNote({
      title: `${pad.title}-Copy`,
      content: pad.content
    });
    return note.id;
  } catch (err) {
    console.log(err);
    return null;
  }
}

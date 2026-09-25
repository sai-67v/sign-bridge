import { useCallback, useEffect, useMemo, useState } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { useNavigate, useParams } from "react-router-dom"
import { HiOutlineDocument, HiOutlinePlus } from "react-icons/hi"
import { TbClipboardList } from "react-icons/tb"
import { useAuth } from "../../hooks/useAuth"
import { useWorkspaceStore } from "../../store/workspaceStore"
import { useNoteStore } from "../../store/noteStore"
import { useActiveTabsStore } from "../../store/activeTabs"
import { notebookService, type INotebook } from "../../services/notebookService"
import { StickyNote } from "../ui"
import { isWorksheetPad } from "../../utils/worksheetPadDetection"

export function NotebookTree() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { id: activePadId } = useParams()
  const currentNotebookId = useWorkspaceStore((s) => s.currentNotebookId)
  const setCurrentNotebookId = useWorkspaceStore((s) => s.setCurrentNotebookId)
  const { openTab } = useActiveTabsStore()
  const notes = useNoteStore((s) => s.notes)
  const fetchNotes = useNoteStore((s) => s.fetchNotes)

  const [notebooks, setNotebooks] = useState<INotebook[]>([])
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const ownerId = user?.uid || "local-user-123"
  const libraryStructureReadOnly = useWorkspaceStore((s) => s.libraryStructureReadOnly)

  const loadNotebooks = useCallback(async () => {
    try {
      const list = await notebookService.listNotebooks(ownerId)
      setNotebooks(
        list.sort((a, b) =>
          a.isInbox === b.isInbox ? a.name.localeCompare(b.name) : a.isInbox ? -1 : 1
        )
      )
      const inbox = list.find((n) => n.isInbox)
      const sid = useWorkspaceStore.getState().currentNotebookId
      if (!sid && inbox) {
        setCurrentNotebookId(inbox.id)
        await fetchNotes(inbox.id, ownerId)
      }
    } catch (e) {
      console.warn("[PAD] list notebooks failed", e)
      setNotebooks([])
    }
  }, [ownerId, setCurrentNotebookId, fetchNotes])

  useEffect(() => {
    loadNotebooks()
  }, [loadNotebooks])

  useEffect(() => {
    if (currentNotebookId) {
      fetchNotes(currentNotebookId, ownerId)
      setExpanded((e) => ({ ...e, [currentNotebookId]: true }))
    }
  }, [currentNotebookId, fetchNotes, ownerId])

  const filteredNotes = useMemo(() => {
    const list =
      currentNotebookId == null ? notes : notes.filter((n) => (n.notebookId || null) === currentNotebookId)
    return [...list].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
  }, [notes, currentNotebookId])

  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null)

  const virtualizer = useVirtualizer({
    count: filteredNotes.length,
    getScrollElement: () => scrollEl,
    estimateSize: () => 40,
    overscan: 8,
  })

  const handleNewNotebook = async () => {
    if (libraryStructureReadOnly) {
      window.alert("Notebook is view-only.")
      return
    }
    const name = window.prompt("Notebook name", "Notebook")
    if (!name?.trim()) return
    try {
      const nb = await notebookService.createNotebook(ownerId, { name: name.trim() })
      await loadNotebooks()
      setCurrentNotebookId(nb.id)
    } catch (e) {
      console.error(e)
    }
  }

  const handleNoteClick = (noteId: string) => {
    openTab(noteId)
    navigate(`/app/pad/${noteId}`)
  }

  // keep expanded in sync
  useEffect(() => {
    if (currentNotebookId) {
      setExpanded((ex) => ({ ...ex, [currentNotebookId]: true }))
    }
  }, [currentNotebookId])

  return (
    <div className="app-sidebar__notebooks">
      <div className="app-sidebar__section-head">
        <span className="app-sidebar__label">Notebooks</span>
        <button
          type="button"
          className="app-sidebar__icon-action"
          title="New notebook"
          aria-label="New notebook"
          onClick={handleNewNotebook}
        >
          <HiOutlinePlus className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <ul className="app-sidebar__nb-list">
        {notebooks.map((nb) => (
          <li key={nb.id}>
            <button
              type="button"
              className={`app-sidebar__nb-row ${currentNotebookId === nb.id ? "app-sidebar__nb-row--active" : ""}`}
              onClick={() => {
                setCurrentNotebookId(nb.id)
                setExpanded((ex) => ({ ...ex, [nb.id]: true }))
              }}
            >
              <span className="truncate">{nb.name}</span>
            </button>
            {currentNotebookId === nb.id && expanded[nb.id] && (
              <div
                ref={setScrollEl}
                className="app-sidebar__virt-scroll"
                style={{ maxHeight: 280, overflow: "auto" }}
              >
                {filteredNotes.length === 0 ? (
                  <StickyNote tone="yellow" className="mx-2 my-2 p-3 text-xs shadow-none">
                    No pages yet. Use <strong>New</strong> to create one.
                  </StickyNote>
                ) : (
                  <div
                    style={{
                      height: `${virtualizer.getTotalSize()}px`,
                      position: "relative",
                      width: "100%",
                    }}
                  >
                    {virtualizer.getVirtualItems().map((vi) => {
                      const note = filteredNotes[vi.index]
                      if (!note) return null
                      const isActive = activePadId === note.id
                      const isWs = isWorksheetPad(note, note.content ?? "")
                      return (
                        <div
                          key={note.id}
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100%",
                            transform: `translateY(${vi.start}px)`,
                          }}
                        >
                          <button
                            type="button"
                            className={`app-sidebar__page-row ${isActive ? "app-sidebar__page-row--active" : ""}`}
                            onClick={() => handleNoteClick(note.id)}
                            title={isWs ? `Worksheet: ${note.title || "Untitled"}` : note.title}
                          >
                            {isWs ? (
                              <TbClipboardList
                                className="h-3.5 w-3.5 shrink-0 opacity-70 text-violet-600"
                                aria-hidden
                              />
                            ) : (
                              <HiOutlineDocument className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
                            )}
                            <span className="truncate">{note.title || "Untitled"}</span>
                            {isWs ? (
                              <span
                                className="shrink-0 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-violet-800 dark:bg-violet-950 dark:text-violet-200"
                                title="Worksheet"
                              >
                                Sheet
                              </span>
                            ) : null}
                            {note.classId ? (
                              <span
                                className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground"
                                title="Class workspace page"
                              >
                                Class
                              </span>
                            ) : null}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

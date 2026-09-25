import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import {
  HiOutlineFolderOpen,
  HiOutlineHome,
  HiOutlineTrash,
} from "react-icons/hi"
import { PenLine } from "lucide-react"
import PadNew from "./PadNew"
import { padHomeDualAccentFromId } from "./padHomeIconAccent"
import {
  PadHomeIconClassroom,
  PadHomeIconFolder,
  PadHomeIconNotebook,
  PadHomeIconPage,
  PadHomeIconWorksheet,
} from "./PadHomeIcons"
import { confirmDanger } from "../../components/Confirm"
import { message } from "../../components/message"
import { useAuth } from "../../hooks/useAuth"
import { notebookService } from "../../services/notebookService"
import {
  delPad,
  getPadsByUid,
  libraryPadsOneTilePerNotebook,
  type IPad,
  padLibraryTileBelongsToFolderSubtree,
} from "../../services/pads"
import { deleteAllImageInOnePad } from "../../services/files"
import { decreasePlanRecord } from "../../services/plans"
import { useActiveTabsStore } from "../../store/activeTabs"
import { usePadStore } from "../../store"
import { useFolderStore } from "../../store/folderStore"
import { useWorkspaceStore, isLegacyLocalOnlyFolderId } from "../../store/workspaceStore"
import { useClassroomStore } from "../../store/classroomStore"
import FolderNameDialog from "./FolderNameDialog"
import { getPadMediumTypeWithBody } from "../../utils/worksheetPadDetection"
import { orderedFolderRowsDepthFirst } from "../../lib/folderTreeOrder"
import type { IFolder } from "../../types"

const RECENT_STRIP_MAX = 5
const LIBRARY_COLS_COMPACT = 4
const LIBRARY_ROWS_STEP = 2
const LIBRARY_GRID_MAX_VISIBLE = 6
const HOME_GRID_MIN_ROWS = 2

export default function PadEmpty() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const ownerId = user?.uid || "local-user-123"

  const ensureStructureWriteAccess = (): boolean => {
    if (!user?.uid) {
      message.error("Sign in to change your library.")
      return false
    }
    if (libraryStructureReadOnly) {
      message.warning(
        "This library is view-only. You can open pages but not add or rename items here."
      )
      return false
    }
    return true
  }

  const openTab = useActiveTabsStore((s) => s.openTab)
  const closeTab = useActiveTabsStore((s) => s.closeTab)
  const bumpPadList = usePadStore((s) => s.setNeedToUpdate)
  const padLibraryVersion = usePadStore((s) => s.needToUpdate)
  const currentNotebookId = useWorkspaceStore((s) => s.currentNotebookId)
  const setCurrentNotebookId = useWorkspaceStore((s) => s.setCurrentNotebookId)
  const selectedFolderId = useWorkspaceStore((s) => s.selectedFolderId)
  const setSelectedFolderId = useWorkspaceStore((s) => s.setSelectedFolderId)
  const mediumFilter = useWorkspaceStore((s) => s.mediumFilter)
  const setMediumFilter = useWorkspaceStore((s) => s.setMediumFilter)
  const folders = useWorkspaceStore((s) => s.folders)
  const renameFolder = useWorkspaceStore((s) => s.renameFolder)
  const libraryStructureReadOnly = useWorkspaceStore((s) => s.libraryStructureReadOnly)
  const remoteFolders = useFolderStore((s) => s.folders)
  const fetchFolders = useFolderStore((s) => s.fetchFolders)
  const updateRemoteFolder = useFolderStore((s) => s.updateFolder)
  const fetchMyClassrooms = useClassroomStore((s) => s.fetchMyClassrooms)
  const myClassrooms = useClassroomStore((s) => s.myClassrooms)
  const classroomsLoading = useClassroomStore((s) => s.loading)

  const [pages, setPages] = useState<IPad[]>([])
  /** `notebooks` collection `folderId` per notebook — used when page notes omit folderId. */
  const [notebookFolderByNotebookId, setNotebookFolderByNotebookId] = useState<
    ReadonlyMap<string, string | null>
  >(() => new Map())
  const [folderShowCount, setFolderShowCount] = useState(8)
  const [pageGridRows, setPageGridRows] = useState(HOME_GRID_MIN_ROWS)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [pageSelectMode, setPageSelectMode] = useState(false)
  const [selectedPageIds, setSelectedPageIds] = useState<Set<string>>(() => new Set())
  const [renameFolderOpen, setRenameFolderOpen] = useState(false)
  const [renameFolderId, setRenameFolderId] = useState<string | null>(null)
  /** False until first `fetchFolders` for this session completes — avoids pruning before server list exists. */
  const [remoteFoldersReady, setRemoteFoldersReady] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const inboxId = await notebookService.ensureInboxNotebook(ownerId)
      if (!currentNotebookId && inboxId) {
        setCurrentNotebookId(inboxId)
      }
      const [padList, notebooks] = await Promise.all([
        getPadsByUid(ownerId),
        notebookService.listNotebooks(ownerId).catch((err) => {
          console.warn("listNotebooks failed", err)
          return [] as Awaited<ReturnType<typeof notebookService.listNotebooks>>
        }),
      ])
      const m = new Map<string, string | null>()
      for (const nb of notebooks) {
        m.set(nb.id, nb.folderId ?? null)
      }
      setNotebookFolderByNotebookId(m)
      setPages((padList ?? []).sort((a, b) => b.updatedAt.toMillis() - a.updatedAt.toMillis()))
    } catch (error) {
      console.error(error)
      message.error("Could not load your library")
    } finally {
      setLoading(false)
    }
  }, [currentNotebookId, ownerId, setCurrentNotebookId])

  useEffect(() => {
    reload()
  }, [reload, padLibraryVersion])

  useEffect(() => {
    if (!user?.uid) return
    void fetchMyClassrooms(user.uid)
  }, [user?.uid, fetchMyClassrooms])

  useEffect(() => {
    if (location.hash !== "#pad-home-classes") return
    const el = document.getElementById("pad-home-classes")
    if (el) {
      window.requestAnimationFrame(() => el.scrollIntoView({ behavior: "smooth", block: "start" }))
    }
  }, [location.hash])

  useEffect(() => {
    if (!user?.uid) {
      setRemoteFoldersReady(false)
      return
    }
    let cancelled = false
    setRemoteFoldersReady(false)
    void (async () => {
      await fetchFolders(user.uid)
      if (!cancelled) {
        useWorkspaceStore.getState().pruneLegacyClientFolders()
        setRemoteFoldersReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user?.uid, fetchFolders])

  /** Drop stale folder selection / workspace rows from another account or deleted folders. */
  useEffect(() => {
    if (!user?.uid || !remoteFoldersReady) return
    const allowed = new Set<string>()
    for (const f of remoteFolders) {
      allowed.add(f.id)
    }
    for (const p of pages) {
      if (p.folderId) allowed.add(p.folderId)
    }
    for (const fid of notebookFolderByNotebookId.values()) {
      if (fid != null && String(fid).trim() !== "") allowed.add(String(fid))
    }
    useWorkspaceStore.getState().pruneWorkspaceFolderState(allowed)
  }, [user?.uid, remoteFoldersReady, remoteFolders, pages, notebookFolderByNotebookId])

  const dedupedSorted = useMemo(() => {
    const seen = new Map<string, IPad>()
    for (const p of pages) {
      if (!seen.has(p.id)) seen.set(p.id, p)
    }
    return Array.from(seen.values()).sort((a, b) => b.updatedAt.toMillis() - a.updatedAt.toMillis())
  }, [pages])

  /** One tile per note; sort by recency. Do not scope by ClassroomSelector — personal folders (classId null) would disappear when a class is selected. */
  const libraryTiles = useMemo(
    () => libraryPadsOneTilePerNotebook(dedupedSorted),
    [dedupedSorted],
  )

  const recentStrip = useMemo(() => libraryTiles.slice(0, RECENT_STRIP_MAX), [libraryTiles])

  const sortedPagesHome = useMemo(() => {
    return libraryTiles
      .filter((p) =>
        selectedFolderId
          ? padLibraryTileBelongsToFolderSubtree(
              p,
              selectedFolderId,
              dedupedSorted,
              remoteFolders,
              notebookFolderByNotebookId,
            )
          : true
      )
      .filter((p) => {
        if (mediumFilter === "all") return true
        const mt = getPadMediumTypeWithBody(p)
        if (mediumFilter === "worksheet") return mt === "worksheet"
        if (mediumFilter === "page") return mt === "page"
        if (mediumFilter === "flashcard") return mt === "flashcard"
        return true
      })
  }, [libraryTiles, selectedFolderId, mediumFilter, dedupedSorted, notebookFolderByNotebookId, remoteFolders])

  /**
   * Folders the user can open, in tree order with depth (children indented in data).
   * Home grid uses only `depth === 0` so Materials / Worksheets do not appear as fake “root” tiles.
   */
  const availableFolderRows = useMemo(() => {
    const folderIds = new Set<string>()
    for (const p of pages) {
      if (p.folderId && !isLegacyLocalOnlyFolderId(p.folderId)) folderIds.add(p.folderId)
    }
    for (const f of folders) {
      if (!isLegacyLocalOnlyFolderId(f.id)) folderIds.add(f.id)
    }
    for (const f of remoteFolders) folderIds.add(f.id)

    const dfs = orderedFolderRowsDepthFirst(remoteFolders)
    const rows: { id: string; depth: number }[] = []
    const seen = new Set<string>()
    for (const row of dfs) {
      if (folderIds.has(row.id)) {
        rows.push(row)
        seen.add(row.id)
      }
    }
    for (const id of folderIds) {
      if (!seen.has(id)) rows.push({ id, depth: 0 })
    }
    return rows
  }, [pages, folders, remoteFolders])

  const folderNameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const f of remoteFolders) m.set(f.id, f.name)
    for (const f of folders) m.set(f.id, f.name)
    return m
  }, [folders, remoteFolders])

  const folderCounts = useMemo(() => {
    const m = new Map<string, number>()
    const folderIdsForCounts = new Set<string>()
    for (const p of pages) {
      if (p.folderId && !isLegacyLocalOnlyFolderId(p.folderId)) folderIdsForCounts.add(p.folderId)
    }
    for (const f of folders) {
      if (!isLegacyLocalOnlyFolderId(f.id)) folderIdsForCounts.add(f.id)
    }
    for (const f of remoteFolders) folderIdsForCounts.add(f.id)

    for (const fid of folderIdsForCounts) {
      let n = 0
      for (const p of libraryTiles) {
        if (padLibraryTileBelongsToFolderSubtree(p, fid, dedupedSorted, remoteFolders, notebookFolderByNotebookId)) {
          n += 1
        }
      }
      if (n > 0) m.set(fid, n)
    }
    return m
  }, [libraryTiles, dedupedSorted, notebookFolderByNotebookId, remoteFolders, pages, folders])

  /** Direct children of the folder being viewed (e.g. Materials + Worksheets under class workspace). */
  const childFoldersInSelectedFolder = useMemo((): IFolder[] => {
    if (!selectedFolderId) return []
    return remoteFolders
      .filter((f) => f.parentFolderId === selectedFolderId)
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
  }, [selectedFolderId, remoteFolders])

  const selectedRemoteFolder = useMemo(
    () => (selectedFolderId ? remoteFolders.find((f) => f.id === selectedFolderId) : undefined),
    [remoteFolders, selectedFolderId],
  )

  const isFolderView = !!selectedFolderId

  const rawPageGridLimit = pageGridRows * LIBRARY_COLS_COMPACT
  const pageGridLimit = pageSelectMode
    ? rawPageGridLimit
    : Math.min(rawPageGridLimit, LIBRARY_GRID_MAX_VISIBLE)
  const pagesVisible = sortedPagesHome.slice(0, pageGridLimit)
  const hasMorePages =
    !pageSelectMode &&
    pagesVisible.length < sortedPagesHome.length &&
    pagesVisible.length < LIBRARY_GRID_MAX_VISIBLE

  const rootFolderRowsForHome = useMemo(
    () => availableFolderRows.filter((r) => r.depth === 0),
    [availableFolderRows],
  )

  const folderSlotsForAll = rootFolderRowsForHome.slice(0, Math.max(0, folderShowCount - 1))
  const hasMoreFolders = rootFolderRowsForHome.length > folderSlotsForAll.length

  const openPage = (pageId: string) => {
    openTab(pageId)
    navigate(`/app/pad/${pageId}`)
  }

  const exitPageSelectMode = useCallback(() => {
    setPageSelectMode(false)
    setSelectedPageIds(new Set())
  }, [])

  const enterPageSelectMode = () => {
    if (!ensureStructureWriteAccess()) return
    if (pages.length === 0) {
      message.info("You have no pages to delete.")
      return
    }
    setPageSelectMode(true)
    setSelectedPageIds(new Set())
    const need = Math.ceil(sortedPagesHome.length / LIBRARY_COLS_COMPACT)
    setPageGridRows((r) => Math.max(r, need, HOME_GRID_MIN_ROWS))
  }

  const togglePageSelected = (pageId: string) => {
    setSelectedPageIds((prev) => {
      const next = new Set(prev)
      if (next.has(pageId)) next.delete(pageId)
      else next.add(pageId)
      return next
    })
  }

  const deleteSelectedPages = () => {
    if (selectedPageIds.size === 0) return
    const selectedTiles = dedupedSorted.filter((p) => selectedPageIds.has(p.id))
    const ids = new Set<string>()
    const notebookIds = new Set<string>()

    for (const tile of selectedTiles) {
      if (tile.notebookId && tile.padType !== "worksheet") {
        notebookIds.add(tile.notebookId)
        for (const p of dedupedSorted) {
          if (p.notebookId === tile.notebookId && p.padType !== "worksheet") {
            ids.add(p.id)
          }
        }
      } else {
        ids.add(tile.id)
      }
    }

    const idsToDelete = [...ids]
    const n = selectedTiles.length
    confirmDanger({
      title: n === 1 ? "Delete this item" : `Delete ${n} items`,
      desc:
        n === 1
          ? "Are you sure you want to delete this item? This cannot be undone."
          : `Are you sure you want to delete ${n} items? This cannot be undone.`,
      yesLabel: "Delete",
      noLabel: "Cancel",
      yes: async () => {
        setBusy(true)
        try {
          if (idsToDelete.length >= 20) {
            message.info("Deleting many items — this may take a moment if Appwrite rate-limits.")
          }
          for (let i = 0; i < idsToDelete.length; i++) {
            const id = idsToDelete[i]
            const [outcome] = await Promise.all([delPad(id), deleteAllImageInOnePad(id)])
            if (outcome === "deleted") {
              await decreasePlanRecord()
            }
            closeTab(id)
            if (i < idsToDelete.length - 1) {
              await new Promise((r) => setTimeout(r, 100))
            }
          }
          const notebookIdArr = [...notebookIds]
          for (let i = 0; i < notebookIdArr.length; i++) {
            const notebookId = notebookIdArr[i]
            await notebookService.deleteNotebook(notebookId).catch((err) => {
              const code =
                err && typeof err === "object" && "code" in err
                  ? Number((err as { code: unknown }).code)
                  : NaN
              if (code !== 404) {
                console.warn("Failed to delete notebook metadata", notebookId, err)
              }
            })
            if (i < notebookIdArr.length - 1) {
              await new Promise((r) => setTimeout(r, 100))
            }
          }
          if (currentNotebookId && notebookIds.has(currentNotebookId)) {
            setCurrentNotebookId(null)
          }
          bumpPadList()
          await reload()
          exitPageSelectMode()
          message.success(n === 1 ? "Deleted item successfully" : `Deleted ${n} items`)
        } catch (err) {
          console.error(err)
          message.error("Could not delete one or more items")
        } finally {
          setBusy(false)
        }
      },
    })
  }

  const mediumIcon = (p: IPad, className: string, accent: number) => {
    const mt = getPadMediumTypeWithBody(p)
    if (mt === "worksheet") return <PadHomeIconWorksheet className={className} accentIndex={accent} />
    if (mt === "notebook") return <PadHomeIconNotebook className={className} accentIndex={accent} />
    return <PadHomeIconPage className={className} accentIndex={accent} />
  }

  const padTileAccent = (p: IPad) => p.tileAccentIndex ?? padHomeDualAccentFromId(p.id)

  const folderTileAccent = (folderId: string) =>
    folders.find((f) => f.id === folderId)?.accentIndex ?? padHomeDualAccentFromId(folderId)

  const requestRenameFolder = (folderId: string) => {
    if (!ensureStructureWriteAccess()) return
    setRenameFolderId(folderId)
    setRenameFolderOpen(true)
  }

  return (
    <main className="pad-home" aria-labelledby="pad-home-title">
      <FolderNameDialog
        open={renameFolderOpen}
        title="Rename folder"
        submitLabel="Save"
        initialValue={
          renameFolderId
            ? folderNameById.get(renameFolderId) || `Folder ${renameFolderId.slice(0, 8)}`
            : ""
        }
        initialAccentIndex={
          renameFolderId
            ? folders.find((f) => f.id === renameFolderId)?.accentIndex ??
              padHomeDualAccentFromId(renameFolderId)
            : 0
        }
        onOpenChange={(open) => {
          setRenameFolderOpen(open)
          if (!open) setRenameFolderId(null)
        }}
        onSubmit={async ({ name, accentIndex }) => {
          if (!renameFolderId) return
          const nextName = name.trim()
          if (!nextName) return
          const isLegacyLocalOnly = renameFolderId != null && isLegacyLocalOnlyFolderId(renameFolderId)
          if (user?.uid && !isLegacyLocalOnly) {
            try {
              await updateRemoteFolder(renameFolderId, { name: nextName })
            } catch (e) {
              console.error(e)
              message.error("Could not rename folder on the server.")
              throw e instanceof Error ? e : new Error("rename folder failed")
            }
          }
          renameFolder(renameFolderId, nextName, accentIndex)
          message.success("Folder renamed")
        }}
      />
      <header className="pad-home__header">
        <div className="pad-home__header-leading">
          <h1 id="pad-home-title" className="pad-home__brand-heading">
            <span className="pad-home__brand pad-home__brand--static">
              <span className="pad-home__brand-icon" aria-hidden>
                {isFolderView ? <HiOutlineFolderOpen /> : <HiOutlineHome />}
              </span>
              <span className="pad-home__brand-title">
                {isFolderView
                  ? (selectedFolderId ? folderNameById.get(selectedFolderId) || `Folder ${selectedFolderId.slice(0, 8)}` : "Folder")
                  : "Home"}
              </span>
              {isFolderView && selectedFolderId ? (
                <button
                  type="button"
                  className="ml-2 inline-flex items-center justify-center rounded-sm p-1 text-[var(--common-semidark-text-color)] hover:text-[var(--common-text-color)]"
                  onClick={() => requestRenameFolder(selectedFolderId)}
                  aria-label="Rename folder"
                  title="Rename folder"
                >
                  <PenLine className="h-4 w-4" />
                </button>
              ) : null}
            </span>
          </h1>
        </div>
        <div className="pad-home__header-actions">
          <PadNew />
          {pageSelectMode ? (
            <>
              <button type="button" className="pad-home__reload" onClick={exitPageSelectMode} disabled={busy}>
                Cancel
              </button>
              <button
                type="button"
                className="pad-home__reload pad-home__reload--danger"
                onClick={deleteSelectedPages}
                disabled={busy || selectedPageIds.size === 0}
              >
                Delete{selectedPageIds.size > 0 ? ` (${selectedPageIds.size})` : ""}
              </button>
            </>
          ) : null}
          <button type="button" className="pad-home__reload" onClick={reload} disabled={loading || busy || pageSelectMode}>
            {loading ? "Loading" : "Refresh"}
          </button>
          {!pageSelectMode ? (
            <button
              type="button"
              className="pad-home__icon-btn pad-home__icon-btn--danger"
              onClick={enterPageSelectMode}
              disabled={loading || busy || libraryStructureReadOnly || pages.length === 0 || !user?.uid}
              aria-label="Select pages to delete"
              title="Select pages to delete"
            >
              <HiOutlineTrash className="h-5 w-5" aria-hidden />
            </button>
          ) : null}
        </div>
      </header>

      {!isFolderView ? (
        <>
          {user?.uid ? (
            <section
              id="pad-home-classes"
              className="pad-home__workspace pad-home__teaching"
              aria-label="Your classes"
            >
              <h2 className="pad-home__section-label">Your classes</h2>
              {classroomsLoading ? (
                <div className="pad-home__empty pad-home__empty--muted">Loading classes…</div>
              ) : myClassrooms.length === 0 ? (
                <p className="pad-home__empty pad-home__empty--muted max-w-xl text-sm leading-relaxed">
                  {user.role === "student"
                    ? "When your school enrolls you in a class, it will show up here."
                    : "Classes are created by your administrator and appear here once you are assigned."}
                </p>
              ) : (
                <ul className="pad-home__folder-grid" style={{ maxWidth: "42rem" }}>
                  {myClassrooms.map((c) => (
                    <li key={c.id} className="contents">
                      <button
                        type="button"
                        className="pad-home__cube pad-home__cube--strip"
                        onClick={() => navigate(`/app/pad/classroom/${c.id}`)}
                        aria-label={`Open class ${c.name}`}
                      >
                        <span className="pad-home__cube-visual" aria-hidden>
                          <PadHomeIconClassroom
                            className="pad-home__cube-ico"
                            accentIndex={folderTileAccent(c.id)}
                          />
                        </span>
                        <span className="pad-home__cube-title">{c.name}</span>
                        {c.subject ? (
                          <span className="pad-home__cube-meta text-xs opacity-80">{c.subject}</span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}
          <section className="pad-home__recent-strip-wrap" aria-label="Recent">
            <h2 className="pad-home__section-label">Recent</h2>
            {loading ? (
              <div className="pad-home__empty pad-home__empty--muted">Loading…</div>
            ) : recentStrip.length === 0 ? (
              <div className="pad-home__recent-empty" role="status">
                <p className="pad-home__recent-empty__title">No recent pages</p>
                <p className="pad-home__recent-empty__hint">
                  Create a page from the toolbar above. Anything you open or edit will show up here.
                </p>
              </div>
            ) : (
              <ul className="pad-home__recent-strip">
                {recentStrip.map((page) => (
                  <li key={`strip-${page.id}`} className="pad-home__recent-strip-item">
                    <button
                      type="button"
                      className="pad-home__cube pad-home__cube--strip"
                      onClick={() => openPage(page.id)}
                      disabled={busy}
                      aria-label={page.title || "Untitled"}
                    >
                      <span className="pad-home__cube-visual">
                        {mediumIcon(page, "pad-home__cube-ico", padTileAccent(page))}
                      </span>
                      <span className="pad-home__cube-title">{page.title || "Untitled"}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="pad-home__workspace" aria-label="Folders">
            <h2 className="pad-home__section-label">Folders</h2>
            <div className="pad-home__folder-grid">
              {folderSlotsForAll.map(({ id: folderId }) => (
                <button
                  key={folderId}
                  type="button"
                  className="pad-home__cube pad-home__cube--strip"
                  onClick={() => setSelectedFolderId(folderId)}
                  onDoubleClick={(event) => {
                    event.preventDefault()
                    requestRenameFolder(folderId)
                  }}
                  aria-pressed={false}
                >
                  <span className="pad-home__cube-visual" aria-hidden>
                    <PadHomeIconFolder
                      className="pad-home__cube-ico"
                      accentIndex={folderTileAccent(folderId)}
                    />
                  </span>
                  <span
                    className="pad-home__cube-title cursor-text"
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      requestRenameFolder(folderId)
                    }}
                    title="Click to rename folder"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        event.stopPropagation()
                        requestRenameFolder(folderId)
                      }
                    }}
                  >
                    {folderNameById.get(folderId) || `Folder ${folderId.slice(0, 8)}`}
                  </span>
                  <span className="pad-home__cube-meta">
                    {folderCounts.get(folderId) ?? 0} items
                  </span>
                </button>
              ))}
            </div>
            {hasMoreFolders ? (
              <button
                type="button"
                className="pad-home__tiles-more pad-home__tiles-more--inline"
                onClick={() => setFolderShowCount((n) => n + 6)}
              >
                More folders
              </button>
            ) : null}
            {rootFolderRowsForHome.length === 0 ? (
              <div className="pad-home__empty pad-home__empty--muted">No folders yet.</div>
            ) : null}
          </section>
        </>
      ) : (
        <section className="pad-home__workspace" aria-label="Folder content">
          <div className="pad-home__folder-view-nav">
            {selectedFolderId ? (
              selectedRemoteFolder?.parentFolderId ? (
                <button
                  type="button"
                  className="pad-home__folder-up"
                  onClick={() => setSelectedFolderId(selectedRemoteFolder.parentFolderId ?? null)}
                >
                  ←{" "}
                  {folderNameById.get(selectedRemoteFolder.parentFolderId) ||
                    `Folder ${selectedRemoteFolder.parentFolderId.slice(0, 8)}`}
                </button>
              ) : (
                <button type="button" className="pad-home__folder-up" onClick={() => setSelectedFolderId(null)}>
                  ← All folders
                </button>
              )
            ) : null}
          </div>

          {childFoldersInSelectedFolder.length > 0 ? (
            <div className="pad-home__folder-view-children" aria-label="Subfolders">
              <h2 className="pad-home__section-label pad-home__section-label--nested">
                {selectedRemoteFolder?.folderKind === "class_workspace"
                  ? "Inside this class workspace"
                  : "Folders inside here"}
              </h2>
              <div className="pad-home__folder-grid pad-home__folder-grid--nested">
                {childFoldersInSelectedFolder.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className="pad-home__cube pad-home__cube--strip"
                    onClick={() => setSelectedFolderId(f.id)}
                    onDoubleClick={(event) => {
                      event.preventDefault()
                      requestRenameFolder(f.id)
                    }}
                    aria-label={`Open folder ${f.name}`}
                  >
                    <span className="pad-home__cube-visual" aria-hidden>
                      {f.name.trim().toLowerCase() === "worksheets" ? (
                        <PadHomeIconWorksheet
                          className="pad-home__cube-ico"
                          accentIndex={folderTileAccent(f.id)}
                        />
                      ) : (
                        <PadHomeIconFolder
                          className="pad-home__cube-ico"
                          accentIndex={folderTileAccent(f.id)}
                        />
                      )}
                    </span>
                    <span className="pad-home__cube-title">{f.name}</span>
                    <span className="pad-home__cube-meta">{folderCounts.get(f.id) ?? 0} items</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="pad-home__filters">
            <span className="pad-home__filters-label">Show</span>
            <button type="button" className="pad-home__reload" onClick={() => setMediumFilter("all")} aria-pressed={mediumFilter === "all"}>
              All media
            </button>
            <button type="button" className="pad-home__reload" onClick={() => setMediumFilter("page")} aria-pressed={mediumFilter === "page"}>
              Pages
            </button>
            <button
              type="button"
              className="pad-home__reload"
              onClick={() => setMediumFilter("worksheet")}
              aria-pressed={mediumFilter === "worksheet"}
            >
              Worksheets
            </button>
          </div>

          <div className="pad-home__workspace-block pad-home__workspace-block--recent">
          {loading ? (
            <div className="pad-home__empty">Loading your pages…</div>
          ) : sortedPagesHome.length === 0 ? (
            <div className="pad-home__empty pad-home__empty--muted">No pages in this view.</div>
          ) : (
            <>
              <div
                className="pad-home__cards pad-home__cards--tiles pad-home__cards--compact"
                aria-label={pageSelectMode ? "Select pages to delete" : "Pages in this folder"}
              >
                {pagesVisible.map((page) => (
                  <div key={`grid-${page.id}`} className="pad-home__tile-shell">
                    <button
                      type="button"
                      className={`pad-home__cube pad-home__cube--compact${pageSelectMode ? " pad-home__cube--selectable" : ""}${selectedPageIds.has(page.id) ? " pad-home__cube--selected" : ""}`}
                      onClick={() => (pageSelectMode ? togglePageSelected(page.id) : openPage(page.id))}
                      disabled={busy}
                      aria-pressed={pageSelectMode ? selectedPageIds.has(page.id) : undefined}
                      aria-label={
                        pageSelectMode
                          ? `${selectedPageIds.has(page.id) ? "Deselect" : "Select"} ${page.title || "Untitled"}`
                          : page.title || "Untitled"
                      }
                    >
                      {pageSelectMode ? (
                        <span className="pad-home__cube-check" aria-hidden>
                          {selectedPageIds.has(page.id) ? "✓" : ""}
                        </span>
                      ) : null}
                      <span className="pad-home__cube-visual">
                        {mediumIcon(page, "pad-home__cube-ico", padTileAccent(page))}
                      </span>
                      <span className="pad-home__cube-title">{page.title || "Untitled"}</span>
                    </button>
                  </div>
                ))}
              </div>
              {hasMorePages && !pageSelectMode && (
                <button
                  type="button"
                  className="pad-home__tiles-more"
                  onClick={() => setPageGridRows((r) => r + LIBRARY_ROWS_STEP)}
                >
                  Load more
                </button>
              )}
            </>
          )}
          </div>
        </section>
      )}
    </main>
  )
}

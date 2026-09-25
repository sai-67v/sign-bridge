import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../../hooks/useAuth"
import { notebookService } from "../../services/notebookService"
import {
  collectFolderIdsForClassroom,
  getPadsByUid,
  libraryPadsOneTilePerNotebook,
  padVisibleForClassroomFilter,
  type IPad,
} from "../../services/pads"
import { usePadStore } from "../../store"
import { useFolderStore } from "../../store/folderStore"
import { useActiveTabsStore } from "../../store/activeTabs"
import { getPadMediumTypeWithBody } from "../../utils/worksheetPadDetection"
import { padHomeDualAccentFromId } from "../Pads/padHomeIconAccent"
import {
  PadHomeIconNotebook,
  PadHomeIconPage,
  PadHomeIconWorksheet,
} from "../Pads/PadHomeIcons"

const LIBRARY_COLS_COMPACT = 4
const LIBRARY_ROWS_STEP = 2
const LIBRARY_GRID_MAX_VISIBLE = 6
const HOME_GRID_MIN_ROWS = 2

type MediumFilter = "all" | "page" | "worksheet"

type Props = {
  classroomId: string
  classroomName: string
}

/**
 * Same tile grid + media filters as Pad Home when a folder is open (`PadEmpty` folder view),
 * scoped to this class's workspace folders (Materials, Worksheets, etc.) and pads tagged with the class.
 */
export function ClassroomStudentClassWorkspaceLibrary({ classroomId, classroomName }: Props) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const ownerId = user?.uid || ""
  const openTab = useActiveTabsStore((s) => s.openTab)
  const padLibraryVersion = usePadStore((s) => s.needToUpdate)
  const remoteFolders = useFolderStore((s) => s.folders)

  const [pages, setPages] = useState<IPad[]>([])
  const [notebookFolderByNotebookId, setNotebookFolderByNotebookId] = useState<
    ReadonlyMap<string, string | null>
  >(() => new Map())
  const [loading, setLoading] = useState(true)
  const [mediumFilter, setMediumFilter] = useState<MediumFilter>("all")
  const [pageGridRows, setPageGridRows] = useState(HOME_GRID_MIN_ROWS)

  const reload = useCallback(async () => {
    if (!ownerId) {
      setPages([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const [padList, notebooks] = await Promise.all([
        getPadsByUid(ownerId),
        notebookService.listNotebooks(ownerId).catch(() => [] as Awaited<ReturnType<typeof notebookService.listNotebooks>>),
      ])
      const m = new Map<string, string | null>()
      for (const nb of notebooks) {
        m.set(nb.id, nb.folderId ?? null)
      }
      setNotebookFolderByNotebookId(m)
      setPages((padList ?? []).sort((a, b) => b.updatedAt.toMillis() - a.updatedAt.toMillis()))
    } catch {
      setPages([])
    } finally {
      setLoading(false)
    }
  }, [ownerId])

  useEffect(() => {
    void reload()
  }, [reload, padLibraryVersion])

  const dedupedSorted = useMemo(() => {
    const seen = new Map<string, IPad>()
    for (const p of pages) {
      if (!seen.has(p.id)) seen.set(p.id, p)
    }
    return Array.from(seen.values()).sort((a, b) => b.updatedAt.toMillis() - a.updatedAt.toMillis())
  }, [pages])

  const libraryTiles = useMemo(() => libraryPadsOneTilePerNotebook(dedupedSorted), [dedupedSorted])

  const allowedFolderIds = useMemo(
    () => collectFolderIdsForClassroom(classroomId, remoteFolders),
    [classroomId, remoteFolders]
  )

  const classWorkspaceTiles = useMemo(() => {
    return libraryTiles.filter((p) =>
      padVisibleForClassroomFilter(p, classroomId, allowedFolderIds, dedupedSorted, notebookFolderByNotebookId)
    )
  }, [libraryTiles, classroomId, allowedFolderIds, dedupedSorted, notebookFolderByNotebookId])

  const sortedTiles = useMemo(() => {
    return classWorkspaceTiles.filter((p) => {
      if (mediumFilter === "all") return true
      const mt = getPadMediumTypeWithBody(p)
      if (mediumFilter === "worksheet") return mt === "worksheet"
      if (mediumFilter === "page") return mt === "page"
      return true
    })
  }, [classWorkspaceTiles, mediumFilter])

  const rawPageGridLimit = pageGridRows * LIBRARY_COLS_COMPACT
  const pageGridLimit = Math.min(rawPageGridLimit, LIBRARY_GRID_MAX_VISIBLE)
  const pagesVisible = sortedTiles.slice(0, pageGridLimit)
  const hasMorePages =
    pagesVisible.length < sortedTiles.length && pagesVisible.length < LIBRARY_GRID_MAX_VISIBLE

  const openPage = (pageId: string) => {
    openTab(pageId)
    navigate(`/app/pad/${pageId}`)
  }

  const mediumIcon = (p: IPad, className: string, accent: number) => {
    const mt = getPadMediumTypeWithBody(p)
    if (mt === "worksheet") return <PadHomeIconWorksheet className={className} accentIndex={accent} />
    if (mt === "notebook") return <PadHomeIconNotebook className={className} accentIndex={accent} />
    return <PadHomeIconPage className={className} accentIndex={accent} />
  }

  const padTileAccent = (p: IPad) => p.tileAccentIndex ?? padHomeDualAccentFromId(p.id)

  return (
    <section className="classroom-hub__class-workspace pad-home__workspace" aria-label="Class workspace library">
      <h2 className="pad-home__section-label">Class workspace</h2>
      <p className="classroom-hub__hint classroom-hub__class-workspace-lede">
        Same view as <strong>{classroomName} — class workspace</strong> on Library home: materials and pages in this
        class.
      </p>
      <div className="pad-home__filters">
        <span className="pad-home__filters-label">Show</span>
        <button
          type="button"
          className="pad-home__reload"
          onClick={() => setMediumFilter("all")}
          aria-pressed={mediumFilter === "all"}
        >
          All media
        </button>
        <button
          type="button"
          className="pad-home__reload"
          onClick={() => setMediumFilter("page")}
          aria-pressed={mediumFilter === "page"}
        >
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
        <button type="button" className="pad-home__reload" onClick={() => void reload()} disabled={loading}>
          {loading ? "Loading" : "Refresh"}
        </button>
      </div>

      <div className="pad-home__workspace-block pad-home__workspace-block--recent">
        {loading ? (
          <div className="pad-home__empty">Loading your pages…</div>
        ) : sortedTiles.length === 0 ? (
          <div className="pad-home__empty pad-home__empty--muted">No pages in this class workspace yet.</div>
        ) : (
          <>
            <div className="pad-home__cards pad-home__cards--tiles pad-home__cards--compact" aria-label="Class workspace items">
              {pagesVisible.map((page) => (
                <div key={`cw-${page.id}`} className="pad-home__tile-shell">
                  <button
                    type="button"
                    className="pad-home__cube pad-home__cube--compact"
                    onClick={() => openPage(page.id)}
                    aria-label={page.title || "Untitled"}
                  >
                    <span className="pad-home__cube-visual">
                      {mediumIcon(page, "pad-home__cube-ico", padTileAccent(page))}
                    </span>
                    <span className="pad-home__cube-title">{page.title || "Untitled"}</span>
                  </button>
                </div>
              ))}
            </div>
            {hasMorePages ? (
              <button
                type="button"
                className="pad-home__tiles-more"
                onClick={() => setPageGridRows((r) => r + LIBRARY_ROWS_STEP)}
              >
                Load more
              </button>
            ) : null}
          </>
        )}
      </div>
    </section>
  )
}

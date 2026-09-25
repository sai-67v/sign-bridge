import { useEffect, useRef, useState, type ReactNode } from "react"
import { useNavigate, useParams } from "react-router-dom"
import PadEditor from "../../components/PadEditor"
import { isWorksheetPad } from "../../utils/worksheetPadDetection"
import { getCacheJSON, setCacheJSON } from "../../libs/localCache"
import { decryptText } from "../../services/encryption"
import {
  getPadById,
  IPad,
  rehydrateIPad,
  saveCurrentPad,
  updateNotebookCoverTitleIfFirstPage,
  updatePadMetadata,
} from "../../services/pads"
import { usePadStore } from "../../store"
import { usePadListStore } from "../../store/pad"
import { useNoteStore } from "../../store/noteStore"
import { useActiveTabsStore } from "../../store/activeTabs"
import { MaterialPane } from "../../components/MaterialPane/MaterialPane"
import { MaterialResizer } from "../../components/MaterialPane/MaterialResizer"
import PaperSheet from "../../components/PaperChrome/PaperSheet"
import { PadDockAnchorSync } from "../../components/PaperChrome/PadDockAnchorSync"
import { ToolsDock } from "../../components/PaperChrome/ToolsDock"
import { TypewriterDock } from "../../components/PaperChrome/TypewriterDock"
import { AISidebar } from "../../components/AISidebar/AISidebar"
import { useAuth } from "../../hooks/useAuth"
import { classroomService } from "../../services/classroomService"
import { materialService } from "../../services/materialService"
import { useWorkspaceStore } from "../../store/workspaceStore"
import { usePaperUiStore } from "../../store/paperUiStore"
import { currentPadContentStorageKey } from "../../services/padClientStorage"

function PadContent() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { setIdShared } = usePadStore((state) => state)
  const padContentCacheKey = user?.uid ? currentPadContentStorageKey(user.uid) : null
  /** localStorage round-trips strip Timestamp prototypes — rehydrate before use. */
  const cachedPad = padContentCacheKey
    ? rehydrateIPad(getCacheJSON(padContentCacheKey) as IPad | null)
    : null
  const { query } = usePadListStore()
  const { openTab } = useActiveTabsStore()
  const { id } = useParams()
  const [pad, setPad] = useState<IPad | null>(cachedPad?.id === id ? cachedPad : null)
  const [padLoadError, setPadLoadError] = useState<string | null>(null)
  const [padLoading, setPadLoading] = useState(!!id)
  const padEditorColumnRef = useRef<HTMLDivElement>(null)

  const getContent = (p: IPad) => {
    const enabledIfShared = query.shared
    if (enabledIfShared && p.sharedContent) {
      return p.sharedContent
    } else if (p.cipherContent) {
      const decrypted = decryptText(p.cipherContent)
      return decrypted || p.content
    }
    return p.content
  }

  useEffect(() => {
    if (id) {
      openTab(id)
    }
  }, [id, openTab])

  useEffect(() => {
    setPadLoadError(null)

    if (!id) {
      setPad(null)
      setPadLoading(false)
      return
    }

    saveCurrentPad(id)

    // Always refetch by route id. Skipping when state already matched id left stale UI:
    // localStorage cache + pad state were initialized from an empty first load
    // while updatePad had already persisted newer content to Appwrite.

    setPad(null)
    setPadLoading(true)
    getPadById(id).then((res) => {
      setPadLoading(false)
      if (!res) {
        try {
          if (
            padContentCacheKey &&
            (getCacheJSON(padContentCacheKey) as IPad | null)?.id === id
          ) {
            localStorage.removeItem(padContentCacheKey)
          }
        } catch {
          /* ignore */
        }
        setPadLoadError(
          "This page could not be opened. It may have been deleted or you may not have permission to view it."
        )
        return
      }
      if (padContentCacheKey) {
        setCacheJSON(padContentCacheKey, res)
      }
      setIdShared("")
      setPad(res)

      useNoteStore.getState().setCurrentNote({
        id: res.id,
        title: res.title,
        content: getContent(res) || "",
        createdAt: res.createdAt.toMillis(),
        updatedAt: res.updatedAt.toMillis(),
        uid: res.uid,
        ownerId: res.uid,
        padType: res.padType,
        worksheetSections: res.worksheetSections,
        studentAnswers: res.studentAnswers,
        notebookId: res.notebookId ?? undefined,
        folderId: res.folderId ?? undefined,
        classId: res.classId ?? undefined,
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load pad by route id; padContentCacheKey tracks account
  }, [id, padContentCacheKey])

  /** Open material pane when this pad is class-scoped and the class library already has PDFs (US3). */
  useEffect(() => {
    if (!pad?.classId || !user?.uid) return
    let cancelled = false
    ;(async () => {
      try {
        const classroom = await classroomService.getClassroom(pad.classId!)
        let fid = classroom.materialsFolderId ?? null
        if (!fid && classroom.teacherId) {
          fid = (await materialService.inferSharedClassMaterialsFolderId(classroom.teacherId)) ?? null
        }
        if (!fid || cancelled) return
        const mats = await materialService.listMaterialsInClassFolder(fid)
        if (!cancelled && mats.length > 0) {
          useWorkspaceStore.getState().setMaterialPaneOpen(true)
        }
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [pad?.id, pad?.classId, user?.uid])

  /** Worksheets use the same dual draw/type chrome as pages so teachers can switch to “type” mode from the pen dock. */
  useEffect(() => {
    if (!id || !pad) return
    const body = getContent(pad) || ""
    if (!isWorksheetPad(pad, body)) return
    usePaperUiStore.getState().openTypePanel()
  }, [id, pad?.id])

  let loadedPadLayout: ReactNode = null
  if (id && pad) {
    const body = getContent(pad) || ""
    const worksheetShell = isWorksheetPad(pad, body)
    const commitTitleFor = (target: IPad) => (title: string) => {
      if (!title || title === target.title) return
      const nextPad = { ...target, title }
      if (target.id === pad.id) setPad(nextPad)
      if (target.id === pad.id) {
        useNoteStore.getState().setCurrentNote({
          id: nextPad.id,
          title: nextPad.title,
          content: getContent(nextPad) || "",
          createdAt: nextPad.createdAt.toMillis(),
          updatedAt: nextPad.updatedAt.toMillis(),
          uid: nextPad.uid,
          ownerId: nextPad.uid,
          padType: nextPad.padType,
          worksheetSections: nextPad.worksheetSections,
          studentAnswers: nextPad.studentAnswers,
          notebookId: nextPad.notebookId ?? undefined,
          folderId: nextPad.folderId ?? undefined,
          classId: nextPad.classId ?? undefined,
        })
      }
      updatePadMetadata({ id: target.id, title }).catch(console.error)
      updateNotebookCoverTitleIfFirstPage(nextPad, title).catch(console.error)
    }

    loadedPadLayout = (
      <div className="pad-page-layout pad-page-layout--with-material-slot">
        <PadDockAnchorSync editorRef={padEditorColumnRef} />
        <div ref={padEditorColumnRef} className="pad-page-layout__editor">
          <div className="pad-page-layout__paper-wrap">
            <PaperSheet
              noteId={id}
              paperProfile={pad.paperProfile}
              mediumType={worksheetShell ? "worksheet" : "page"}
              notebookTitle={pad.title ?? ""}
              onNotebookTitleCommit={commitTitleFor(pad)}
            >
              <PadEditor key={id} data={pad} id={id} content={getContent(pad) || ""} />
            </PaperSheet>
          </div>
        </div>
        <TypewriterDock noteId={id} />
        <ToolsDock />
        <MaterialResizer />
        <MaterialPane noteId={id} classId={pad.classId ?? null} />
      </div>
    )
  }

  return (
    <>
      {id && padLoadError && !padLoading ? (
        <div
          className="pad-load-error pad-page-layout"
          role="alert"
          style={{
            padding: "2rem",
            maxWidth: 560,
            margin: "3rem auto",
            border: "1px solid var(--common-border-light-color)",
            borderRadius: 12,
            background: "var(--common-dark-bg-color)",
          }}
        >
          <p className="text-base font-semibold mb-2" style={{ color: "var(--common-text-color)" }}>
            Can’t open this page
          </p>
          <p className="text-sm mb-4" style={{ color: "var(--common-semidark-text-color)" }}>
            {padLoadError}
          </p>
          <button
            type="button"
            className="rounded-md border px-3 py-2 text-sm font-medium"
            style={{
              borderColor: "var(--common-border-color)",
              background: "var(--common-btn-bg-color)",
              color: "var(--common-text-color)",
            }}
            onClick={() => navigate("/app/pad")}
          >
            Back to Home
          </button>
        </div>
      ) : null}
      {id && padLoading && !pad ? (
        <div className="pad-page-layout p-8 text-center text-sm" style={{ color: "var(--common-semidark-text-color)" }}>
          Loading…
        </div>
      ) : null}
      {loadedPadLayout}
      {loadedPadLayout ? <AISidebar /> : null}
    </>
  )
}

export default PadContent

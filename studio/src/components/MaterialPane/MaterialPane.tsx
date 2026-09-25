import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react"
import {
  AlignHorizontalJustifyCenter,
  ChevronLeft,
  ChevronRight,
  Crop,
  Eraser,
  Highlighter,
  ImagePlus,
  Maximize2,
  MessageSquareQuote,
  ZoomIn,
  ZoomOut,
} from "lucide-react"
import { useAuth } from "../../hooks/useAuth"
import { useWorkspaceStore } from "../../store/workspaceStore"
import { useNoteStore } from "../../store/noteStore"
import { materialService, type IMaterial } from "../../services/materialService"
import { notebookService } from "../../services/notebookService"
import { classroomService } from "../../services/classroomService"
import { folderService } from "../../services/folderService"
import { api } from "../../services/api"
import {
  pageMaterialService,
  type IPageMaterial,
} from "../../services/pageMaterialService"
import { usePadEditorStore } from "../../store/padEditorStore"
import { configurePdfWorker } from "../../lib/pdfBootstrap"
import { HiOutlineUpload } from "react-icons/hi"
import { Dropzone, DropzoneContent, DropzoneEmptyState } from "../kibo-ui/dropzone"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Tooltip } from "@/components/ui/Tooltip"

function MaterialResizeHandle({ narrow }: { narrow: boolean }) {
  const setBasis = useWorkspaceStore((s) => s.setMaterialPaneBasisPercent)

  if (narrow) return null

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    const materialEl = e.currentTarget.parentElement as HTMLElement | null
    const layout = materialEl?.closest(".pad-page-layout") as HTMLElement | null
    if (!materialEl || !layout) return

    e.currentTarget.setPointerCapture(e.pointerId)

    const layoutRect = layout.getBoundingClientRect()
    const startMaterialRect = materialEl.getBoundingClientRect()
    const startX = e.clientX
    const startWidth = startMaterialRect.width

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX
      const newWidthPx = startWidth - dx
      const newPct = (newWidthPx / layoutRect.width) * 100
      setBasis(newPct, false)
    }
    const onUp = () => {
      document.body.classList.remove("pad-resize-cursor")
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("pointercancel", onUp)
      setBasis(useWorkspaceStore.getState().materialPaneBasisPercent, true)
    }
    document.body.classList.add("pad-resize-cursor")
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    window.addEventListener("pointercancel", onUp)
  }

  return (
    <div
      className="pad-material__resize-bar"
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize material panel"
      tabIndex={0}
      style={{ touchAction: "none" }}
      onKeyDown={(e) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return
        e.preventDefault()
        const delta = e.key === "ArrowLeft" ? -1 : 1
        const next = useWorkspaceStore.getState().materialPaneBasisPercent + delta
        useWorkspaceStore.getState().setMaterialPaneBasisPercent(next, true)
      }}
      onPointerDown={onPointerDown}
    />
  )
}

function escHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

type ZoomMode = "slide" | "page" | "manual"
type InteractMode = "select" | "highlight" | "clip"

type PdfDocLike = {
  numPages: number
  getPage: (n: number) => Promise<PdfPageLike>
}

type PdfPageLike = {
  getViewport: (opts: { scale: number }) => { width: number; height: number }
  render: (opts: {
    canvasContext: CanvasRenderingContext2D
    viewport: { width: number; height: number }
  }) => { promise: Promise<void>; cancel?: () => void }
  getTextContent: () => Promise<unknown>
}

export type MaterialPaneProps = {
  noteId: string
  /** From loaded pad — enables class materials shelf without waiting on note store. */
  classId?: string | null
}

export function MaterialPane({ noteId, classId: classIdProp }: MaterialPaneProps) {
  const { user } = useAuth()
  const ownerId = user?.uid || "local-user-123"
  const noteClassId = useNoteStore((s) => {
    const hit = s.notes.find((x) => x.id === noteId)
    if (hit?.classId) return hit.classId
    if (s.currentNote?.id === noteId) return s.currentNote.classId ?? undefined
    return undefined
  })
  const [folderResolvedClassId, setFolderResolvedClassId] = useState<string | null>(null)
  const noteFolderId = useNoteStore((s) => {
    const hit = s.notes.find((x) => x.id === noteId)
    if (hit?.folderId) return hit.folderId
    if (s.currentNote?.id === noteId) return s.currentNote.folderId ?? null
    return null
  })

  useEffect(() => {
    if (classIdProp || noteClassId) {
      setFolderResolvedClassId(null)
      return
    }
    if (!ownerId || !noteFolderId) {
      setFolderResolvedClassId(null)
      return
    }
    let cancelled = false
    void classroomService.resolveClassIdForFolder(ownerId, noteFolderId).then((id) => {
      if (!cancelled) setFolderResolvedClassId(id)
    })
    return () => {
      cancelled = true
    }
  }, [classIdProp, noteClassId, ownerId, noteFolderId])

  const effectiveClassId = classIdProp ?? noteClassId ?? folderResolvedClassId ?? null
  const materialPaneOpen = useWorkspaceStore((s) => s.materialPaneOpen)
  const materialPaneBasisPercent = useWorkspaceStore((s) => s.materialPaneBasisPercent)
  const toggleMaterialPane = useWorkspaceStore((s) => s.toggleMaterialPane)
  const currentNotebookId = useWorkspaceStore((s) => s.currentNotebookId)
  const setCurrentNotebookId = useWorkspaceStore((s) => s.setCurrentNotebookId)

  const [pin, setPin] = useState<IPageMaterial | null>(null)
  const [material, setMaterial] = useState<IMaterial | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageCount, setPageCount] = useState(0)
  const [pdfDoc, setPdfDoc] = useState<PdfDocLike | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textLayerRef = useRef<HTMLDivElement>(null)
  const markerCanvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const textLayerRunnerRef = useRef<{ cancel: () => void } | null>(null)
  const renderTaskRef = useRef<{ cancel?: () => void } | null>(null)
  const baseSizeRef = useRef<{ w: number; h: number } | null>(null)
  const loadAbortRef = useRef<AbortController | null>(null)

  const [narrow, setNarrow] = useState(false)
  const [pageStart, setPageStart] = useState(1)
  const [pageEnd, setPageEnd] = useState(1)
  const [uploadBusy, setUploadBusy] = useState(false)
  const [classShelfMaterials, setClassShelfMaterials] = useState<IMaterial[]>([])
  const [classShelfLoading, setClassShelfLoading] = useState(false)
  /** Class teacher uid — only they may open raw Storage view URLs; students use "Use" in-app. */
  const [classShelfTeacherId, setClassShelfTeacherId] = useState<string | null>(null)
  /** Inline user feedback for upload / class-folder validation (replaces blocking alerts). */
  const [materialNotice, setMaterialNotice] = useState<string | null>(null)

  const [zoomMode, setZoomMode] = useState<ZoomMode>("slide")
  const [renderScale, setRenderScale] = useState(1)
  const [pageBusy, setPageBusy] = useState(false)
  const [interactMode, setInteractMode] = useState<InteractMode>("select")

  /** Clip marquee in viewport (client) coordinates */
  const [clipBox, setClipBox] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
  const clipAnchorRef = useRef<{ x: number; y: number } | null>(null)

  const highlightDrawingRef = useRef(false)
  const highlightLastRef = useRef<{ x: number; y: number } | null>(null)

  const materialFlexStyle: CSSProperties | undefined =
    !narrow ? { flex: `0 1 ${materialPaneBasisPercent}%` } : undefined

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)")
    const apply = () => setNarrow(mq.matches)
    apply()
    mq.addEventListener("change", apply)
    return () => mq.removeEventListener("change", apply)
  }, [])

  const measureFit = useCallback(() => {
    if (zoomMode === "manual") return
    const wrap = wrapRef.current
    const base = baseSizeRef.current
    if (!wrap || !base) return
    const pad = 24
    const rw = Math.max(0, wrap.clientWidth - pad)
    const rh = Math.max(0, wrap.clientHeight - pad)
    if (rw <= 0 || rh <= 0) return
    const slide = Math.max(0.15, rw / base.w)
    const pageFit = Math.max(0.15, Math.min(rw / base.w, rh / base.h))
    const next = zoomMode === "slide" ? slide : pageFit
    setRenderScale((prev) => (Math.abs(prev - next) < 0.003 ? prev : next))
  }, [zoomMode])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => measureFit())
    ro.observe(el)
    return () => ro.disconnect()
  }, [measureFit, pdfDoc, page])

  const refresh = useCallback(async () => {
    loadAbortRef.current?.abort()
    const ac = new AbortController()
    loadAbortRef.current = ac
    setLoading(true)
    setErr(null)
    try {
      const p = await pageMaterialService.getForNote(noteId)
      if (ac.signal.aborted) return
      setPin(p)
      if (p) {
        setPageStart(p.pageStart)
        setPageEnd(p.pageEnd)
        const m = await materialService.getMaterial(p.materialId)
        if (ac.signal.aborted) return
        setMaterial(m)
        if (m) {
          setPage(Math.min(Math.max(p.pageStart, 1), m.pageCount || 1))
          const pdfjs = await import("pdfjs-dist")
          configurePdfWorker(pdfjs)
          const data = await materialService.fetchPdfBytes(m.fileId, ac.signal)
          if (ac.signal.aborted) return
          const doc = (await pdfjs.getDocument({ data }).promise) as unknown as PdfDocLike
          setPdfDoc(doc)
          setPageCount(doc.numPages)
        } else {
          setPdfDoc(null)
          setPageCount(0)
        }
      } else {
        setMaterial(null)
        setPdfDoc(null)
        setPageCount(0)
      }
    } catch (e: unknown) {
      if (ac.signal.aborted) return
      setErr(e instanceof Error ? e.message : "Could not load material")
      setPdfDoc(null)
    } finally {
      if (!ac.signal.aborted) setLoading(false)
    }
  }, [noteId])

  useEffect(() => {
    refresh()
    return () => loadAbortRef.current?.abort()
  }, [refresh])

  const refreshClassShelf = useCallback(async () => {
    if (!effectiveClassId || !ownerId) {
      setClassShelfMaterials([])
      setClassShelfTeacherId(null)
      return
    }
    setClassShelfLoading(true)
    try {
      let classroom = await classroomService.getClassroom(effectiveClassId)
      setClassShelfTeacherId(classroom.teacherId || null)
      let folderId = classroom.materialsFolderId ?? null
      if (!folderId && classroom.teacherId === ownerId && classroom.rootFolderId) {
        const f = await folderService.ensureClassMaterialsFolder(ownerId, classroom)
        folderId = f?.id ?? null
        if (folderId) {
          classroom = await classroomService.getClassroom(effectiveClassId)
        }
      }
      if (!folderId && classroom.teacherId) {
        const inferred = await materialService.inferSharedClassMaterialsFolderId(classroom.teacherId)
        folderId = inferred ?? null
        if (folderId && ownerId === classroom.teacherId && !classroom.materialsFolderId) {
          try {
            await classroomService.updateClassroom(classroom.id, { materialsFolderId: folderId })
            classroom = await classroomService.getClassroom(effectiveClassId)
          } catch {
            /* schema may omit materialsFolderId */
          }
        }
      }
      if (!folderId) {
        setClassShelfMaterials([])
        return
      }
      // FR-008: list only when this note sits under **this viewer's** class workspace (teacher root from classroom doc;
      // students use their mirrored `class_workspace` root — not the teacher's folder ids).
      let viewerClassRoot: string | null = null
      if (ownerId === classroom.teacherId) {
        viewerClassRoot = classroom.rootFolderId ?? null
      } else {
        await classroomService.ensureStudentClassWorkspace(ownerId, classroom)
        viewerClassRoot = await folderService.findClassWorkspaceRootFolderId(ownerId, effectiveClassId)
        if (!viewerClassRoot) {
          setClassShelfMaterials([])
          return
        }
      }
      // FR-007 / FR-008: only list shelf when this note folder is under the viewer's workspace for **this** class
      // (teacher `rootFolderId` or student mirrored class_workspace root). Wrong-class pads get an empty shelf.
      if (viewerClassRoot) {
        const underClassTree = await folderService.isFolderDescendantOf(ownerId, noteFolderId, viewerClassRoot)
        if (!underClassTree) {
          setClassShelfMaterials([])
          return
        }
      }
      const list = await materialService.listMaterialsInClassFolder(folderId)
      setClassShelfMaterials(list)
    } catch {
      setClassShelfMaterials([])
      setClassShelfTeacherId(null)
    } finally {
      setClassShelfLoading(false)
    }
  }, [effectiveClassId, ownerId, noteFolderId, noteId])

  useEffect(() => {
    void refreshClassShelf()
  }, [refreshClassShelf])

  /** FR-005 / FR-006: pin class PDF to this note via `page_materials`, then reload editor + shelf. */
  const attachFromClassShelf = async (m: IMaterial) => {
    setUploadBusy(true)
    setMaterialNotice(null)
    try {
      await pageMaterialService.upsertForNote(ownerId, noteId, m.id, 1, m.pageCount || 1)
      await refresh()
      await refreshClassShelf()
    } catch {
      setMaterialNotice("Could not attach this PDF to the page. Try again.")
    } finally {
      setUploadBusy(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!materialPaneOpen && !narrow) return
      if (!pdfDoc || !canvasRef.current) return
      setPageBusy(true)
      textLayerRunnerRef.current?.cancel()
      textLayerRunnerRef.current = null
      renderTaskRef.current?.cancel?.()
      renderTaskRef.current = null

      const n = pdfDoc.numPages
      const p = Math.min(Math.max(1, page), n)
      const pdfPage = (await pdfDoc.getPage(p)) as PdfPageLike
      if (cancelled) return

      const baseVp = pdfPage.getViewport({ scale: 1 })
      baseSizeRef.current = { w: baseVp.width, h: baseVp.height }
      requestAnimationFrame(() => measureFit())

      const pdfjs = await import("pdfjs-dist")
      const vp = pdfPage.getViewport({ scale: renderScale })
      const canvas = canvasRef.current!
      const marker = markerCanvasRef.current
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        setPageBusy(false)
        return
      }

      canvas.width = vp.width
      canvas.height = vp.height
      if (marker) {
        marker.width = vp.width
        marker.height = vp.height
        const mctx = marker.getContext("2d")
        if (mctx) mctx.clearRect(0, 0, marker.width, marker.height)
      }

      const task = pdfPage.render({ canvasContext: ctx, viewport: vp })
      renderTaskRef.current = task
      try {
        await task.promise
      } catch {
        /* RenderingCancelledException when switching pages quickly */
      }
      if (cancelled) return

      const textDiv = textLayerRef.current
      if (textDiv) {
        textDiv.innerHTML = ""
        textDiv.style.width = `${vp.width}px`
        textDiv.style.height = `${vp.height}px`
        const { TextLayer } = pdfjs
        const tc = await pdfPage.getTextContent()
        if (cancelled) return
        const tl = new TextLayer({
          textContentSource: tc as never,
          container: textDiv,
          viewport: vp as never,
        })
        textLayerRunnerRef.current = tl
        try {
          await tl.render()
        } catch {
          /* cancelled */
        }
      }

      setPageBusy(false)
    })()
    return () => {
      cancelled = true
      renderTaskRef.current?.cancel?.()
      textLayerRunnerRef.current?.cancel()
    }
  }, [materialPaneOpen, narrow, pdfDoc, page, renderScale, measureFit])

  useEffect(() => {
    measureFit()
  }, [zoomMode, measureFit])

  useEffect(() => {
    if (interactMode !== "clip") {
      clipAnchorRef.current = null
      setClipBox(null)
    }
  }, [interactMode])

  const bumpZoom = (delta: number) => {
    setZoomMode("manual")
    setRenderScale((s) => Math.min(3, Math.max(0.15, Math.round((s + delta) * 1000) / 1000)))
  }

  const insertImageFromCanvasRegion = (sx: number, sy: number, sw: number, sh: number) => {
    const src = canvasRef.current
    if (!src || sw < 4 || sh < 4 || !material) return
    const ed = usePadEditorStore.getState().getEditor(noteId)
    if (!ed) return
    const tmp = document.createElement("canvas")
    tmp.width = Math.floor(sw)
    tmp.height = Math.floor(sh)
    const tctx = tmp.getContext("2d")
    if (!tctx) return
    tctx.drawImage(src, sx, sy, sw, sh, 0, 0, sw, sh)
    const dataUrl = tmp.toDataURL("image/png")
    const pq = Math.min(Math.max(1, page), pageCount || 1)
    ed.chain()
      .focus()
      .setImage({
        src: dataUrl,
        alt: `${material.title} — p.${pq}`,
        title: `${material.title} (page ${pq})`,
      })
      .run()
  }

  const quoteSelection = () => {
    const t = window.getSelection()?.toString().trim()
    if (!t || !material) return
    const ed = usePadEditorStore.getState().getEditor(noteId)
    if (!ed) return
    const pq = Math.min(Math.max(1, page), pageCount || 1)
    ed.chain()
      .focus()
      .insertContent(
        `<blockquote data-source-material="${escHtml(material.id)}" data-page="${pq}"><p>${escHtml(t)}</p></blockquote>`
      )
      .run()
  }

  const grabFullPageThumb = () => {
    const src = canvasRef.current
    if (!src || !material) return
    insertImageFromCanvasRegion(0, 0, src.width, src.height)
  }

  const clearHighlights = () => {
    const marker = markerCanvasRef.current
    if (!marker) return
    const mctx = marker.getContext("2d")
    if (mctx) mctx.clearRect(0, 0, marker.width, marker.height)
  }

  const onMarkerPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (interactMode !== "highlight") return
    e.preventDefault()
    const canvas = markerCanvasRef.current
    if (!canvas) return
    canvas.setPointerCapture(e.pointerId)
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    highlightDrawingRef.current = true
    highlightLastRef.current = { x, y }
  }

  const onMarkerPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (interactMode !== "highlight" || !highlightDrawingRef.current) return
    const canvas = markerCanvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx || !highlightLastRef.current) return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const prev = highlightLastRef.current
    ctx.save()
    ctx.globalCompositeOperation = "multiply"
    ctx.strokeStyle = "rgba(255, 220, 0, 0.45)"
    ctx.lineWidth = Math.max(14, 18 * renderScale)
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.beginPath()
    ctx.moveTo(prev.x, prev.y)
    ctx.lineTo(x, y)
    ctx.stroke()
    ctx.restore()
    highlightLastRef.current = { x, y }
  }

  const onMarkerPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (interactMode !== "highlight") return
    highlightDrawingRef.current = false
    highlightLastRef.current = null
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }

  const onClipPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (interactMode !== "clip" || e.button !== 0) return
    e.preventDefault()
    const wrap = e.currentTarget
    wrap.setPointerCapture(e.pointerId)
    clipAnchorRef.current = { x: e.clientX, y: e.clientY }
    setClipBox({ x1: e.clientX, y1: e.clientY, x2: e.clientX, y2: e.clientY })
  }

  const onClipPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const anchor = clipAnchorRef.current
    if (interactMode !== "clip" || !anchor) return
    setClipBox({
      x1: anchor.x,
      y1: anchor.y,
      x2: e.clientX,
      y2: e.clientY,
    })
  }

  const onClipPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (interactMode !== "clip") return
    const wrap = e.currentTarget
    try {
      wrap.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }

    const anchor = clipAnchorRef.current
    clipAnchorRef.current = null
    setClipBox(null)
    if (!anchor) return

    const l = Math.min(anchor.x, e.clientX)
    const r = Math.max(anchor.x, e.clientX)
    const t = Math.min(anchor.y, e.clientY)
    const b = Math.max(anchor.y, e.clientY)

    if (r - l < 8 || b - t < 8) return

    const canvas = canvasRef.current
    if (!canvas) return
    const cr = canvas.getBoundingClientRect()
    const il = Math.max(cr.left, l)
    const ir = Math.min(cr.right, r)
    const it = Math.max(cr.top, t)
    const ib = Math.min(cr.bottom, b)
    if (ir - il < 4 || ib - it < 4) return

    const sx = ((il - cr.left) / cr.width) * canvas.width
    const sy = ((it - cr.top) / cr.height) * canvas.height
    const sw = ((ir - il) / cr.width) * canvas.width
    const sh = ((ib - it) / cr.height) * canvas.height
    insertImageFromCanvasRegion(sx, sy, sw, sh)
  }

  const applyPin = async () => {
    if (!material) return
    const maxP = pageCount || 1
    const ps = Math.max(1, Math.min(Math.min(pageStart, pageEnd), maxP))
    const pe = Math.max(1, Math.min(Math.max(pageStart, pageEnd), maxP))
    await pageMaterialService.upsertForNote(ownerId, noteId, material.id, ps, pe)
    await refresh()
  }

  const uploadFile = async (file?: File) => {
    if (!file) {
      return
    }
    if (file.type !== "application/pdf") {
      setMaterialNotice("Please upload a PDF file.")
      return
    }
    setUploadBusy(true)
    setMaterialNotice(null)
    try {
      const notebookId = currentNotebookId || (await notebookService.ensureInboxNotebook(ownerId))
      if (!notebookId) throw new Error("Could not prepare Inbox notebook")
      if (!currentNotebookId) setCurrentNotebookId(notebookId)

      let note =
        useNoteStore.getState().notes.find((n) => n.id === noteId) ??
        (useNoteStore.getState().currentNote?.id === noteId ? useNoteStore.getState().currentNote : null)
      if (!note) {
        try {
          note = await api.getNote(noteId)
        } catch {
          note = null
        }
      }

      let classUploadOpts: { classFolderId?: string } | undefined
      if (note?.classId) {
        try {
          const classroom = await classroomService.getClassroom(note.classId)
          if (classroom.teacherId === ownerId) {
            if (classroom.rootFolderId && note.folderId) {
              const under = await folderService.isFolderDescendantOf(ownerId, note.folderId, classroom.rootFolderId)
              if (!under) {
                setMaterialNotice("Class PDFs can only be uploaded from pages inside this class workspace folder tree.")
                return
              }
            }
            const materialsFolder = await folderService.ensureClassMaterialsFolder(ownerId, classroom)
            if (materialsFolder) {
              classUploadOpts = { classFolderId: materialsFolder.id }
            } else if (!classroom.rootFolderId) {
              console.info(
                "PAD: Class PDF uploads use notebook-only materials until this classroom has a library root folder (classrooms.rootFolderId)."
              )
            }
          }
        } catch (e) {
          console.warn(e)
        }
      }

      const m = await materialService.uploadMaterial(ownerId, notebookId, file, file.name, classUploadOpts)
      await pageMaterialService.upsertForNote(ownerId, noteId, m.id, 1, m.pageCount || 1)
      await refresh()
      await refreshClassShelf()
    } catch (ex) {
      console.error(ex)
      setMaterialNotice("Upload did not finish. Check your connection and try again.")
    } finally {
      setUploadBusy(false)
    }
  }

  const hasMaterial = pin && material

  const openClassMaterialExternal = (m: IMaterial) => {
    window.open(materialService.getFileViewUrl(m.fileId), "_blank", "noopener,noreferrer")
  }

  const canOpenClassMaterialsInNewTab = Boolean(classShelfTeacherId && ownerId === classShelfTeacherId)

  const classShelfUi =
    effectiveClassId ? (
      <div className="mb-3 max-h-64 overflow-hidden rounded-md border border-border bg-muted/25 p-2">
        <p className="mb-1.5 text-2xs font-medium uppercase tracking-wide text-muted-foreground">Class materials</p>
        {materialNotice ? (
          <Alert variant="destructive" className="mb-2 py-2">
            <AlertDescription className="m-0 text-2xs leading-snug">{materialNotice}</AlertDescription>
          </Alert>
        ) : null}
        {classShelfLoading ? (
          <p className="text-2xs text-muted-foreground">Loading shared PDFs…</p>
        ) : classShelfMaterials.length === 0 ? (
          <p className="text-2xs text-muted-foreground">
            No shared PDFs yet. Teachers add them from the class hub → Materials tab (or upload below when this note is in the
            class workspace).
          </p>
        ) : (
          <ul className="flex max-h-52 flex-col gap-1 overflow-y-auto pr-1">
            {classShelfMaterials.map((m) => (
              <li key={m.id} className="flex min-h-0 items-center gap-1">
                <span className="min-w-0 flex-1 truncate rounded border border-border bg-background px-2 py-1.5 text-left text-2xs leading-tight">
                  {m.title}
                </span>
                {canOpenClassMaterialsInNewTab ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-7 shrink-0 px-2 text-2xs"
                    disabled={uploadBusy}
                    title="Open in a new tab (teacher only)"
                    onClick={() => openClassMaterialExternal(m)}
                  >
                    Open
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 shrink-0 px-2 text-2xs"
                  disabled={uploadBusy}
                  title="Use this PDF on this page"
                  onClick={() => void attachFromClassShelf(m)}
                >
                  Use
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    ) : null

  const railBtn = (label: string, child: React.ReactNode, props: React.ComponentProps<typeof Button>) => (
    <Tooltip label={label}>
      <Button type="button" variant="ghost" size="icon" className="size-8 shrink-0" {...props}>
        {child}
      </Button>
    </Tooltip>
  )

  if (pin && !material && !loading) {
    if (!materialPaneOpen && !narrow) {
      return null
    }
    return (
      <div
        className="pad-page-layout__material pad-material pad-material--empty pad-material--placeholder"
        style={materialFlexStyle}
      >
        <MaterialResizeHandle narrow={narrow} />
        <p className="mb-1 text-sm font-medium" style={{ color: "var(--common-semidark-text-color)" }}>
          Material (PDF)
        </p>
        <p className="mb-2 text-xs" style={{ color: "var(--common-semidark-text-color)" }}>
          A PDF was pinned to this page but the file or material record is no longer available (deleted, moved, or permission
          revoked). Attach a new PDF below.
        </p>
        {err && <p className="mb-2 text-xs text-red-600">{err}</p>}
        {classShelfUi}
        <Dropzone
          accept="application/pdf,.pdf"
          disabled={uploadBusy}
          onFilesDrop={(files) => void uploadFile(files[0])}
          className="mt-1"
        >
          <DropzoneContent>
            <HiOutlineUpload className="h-5 w-5 text-[var(--common-semidark-text-color)]" aria-hidden />
            <DropzoneEmptyState>
              {uploadBusy ? "Uploading PDF..." : "Drop PDF here or click to upload"}
            </DropzoneEmptyState>
          </DropzoneContent>
        </Dropzone>
      </div>
    )
  }

  if (!hasMaterial) {
    if (!materialPaneOpen && !narrow) {
      return null
    }
    return (
      <div
        className="pad-page-layout__material pad-material pad-material--empty pad-material--placeholder"
        style={materialFlexStyle}
      >
        <MaterialResizeHandle narrow={narrow} />
        <p className="mb-1 text-sm font-medium" style={{ color: "var(--common-semidark-text-color)" }}>
          Material (PDF)
        </p>
        {classShelfUi}
        <p className="pad-material__hint mb-2 text-xs" style={{ color: "var(--common-semidark-text-color)" }}>
          Attach a PDF from your device below, or choose a class library PDF when available.
        </p>
        <Dropzone
          accept="application/pdf,.pdf"
          disabled={uploadBusy}
          onFilesDrop={(files) => void uploadFile(files[0])}
          className="mt-1"
        >
          <DropzoneContent>
            <HiOutlineUpload className="h-5 w-5 text-[var(--common-semidark-text-color)]" aria-hidden />
            <DropzoneEmptyState>
              {uploadBusy ? "Uploading PDF..." : "Drop PDF here or click to upload"}
            </DropzoneEmptyState>
          </DropzoneContent>
        </Dropzone>
        <p className="mt-2 text-xs" style={{ color: "var(--common-semidark-text-color)" }}>
          PDFs save to your library. Teachers: uploads go to the class Materials folder when this note sits under the class
          workspace; you can also add files from the class hub → Materials tab.
        </p>
      </div>
    )
  }

  if (!materialPaneOpen && narrow) {
    return (
      <button
        type="button"
        className="mx-auto my-2 block rounded-md border px-3 py-2 text-xs"
        style={{
          background: "var(--common-bg-color)",
          borderColor: "var(--common-border-color)",
          color: "var(--common-text-color)",
        }}
        onClick={toggleMaterialPane}
      >
        Show material
      </button>
    )
  }

  if (!materialPaneOpen && !narrow) {
    return null
  }

  return (
    <aside
      className={`pad-page-layout__material pad-material ${narrow ? "pad-material--mobile" : ""}`}
      aria-label="Source material"
      style={materialFlexStyle}
    >
      <MaterialResizeHandle narrow={narrow} />
      {classShelfUi}
      <div className="pad-material__toolbar">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="pad-material__title truncate text-xs" title={material!.title}>
            {material!.title}
          </span>
          <span className="text-2xs tabular-nums text-muted-foreground">
            Page {page} of {pageCount || "—"}
            {zoomMode === "slide" ? " · slide fit" : zoomMode === "page" ? " · full page" : ""}
          </span>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2 text-2xs"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || pageBusy}
          >
            Prev
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2 text-2xs"
            onClick={() => setPage((p) => Math.min(pageCount || 1, p + 1))}
            disabled={page >= (pageCount || 1) || pageBusy}
          >
            Next
          </Button>
        </div>
      </div>

      <div className="pad-material__pin flex flex-wrap items-center gap-2 px-2 py-1.5 text-xs">
        <label className="flex items-center gap-1">
          From
          <input
            type="number"
            min={1}
            max={pageCount || 999}
            className="w-12 rounded border px-1"
            style={{ background: "var(--common-bg-color)", borderColor: "var(--common-border-color)" }}
            value={pageStart}
            onChange={(e) => setPageStart(parseInt(e.target.value, 10) || 1)}
          />
        </label>
        <label className="flex items-center gap-1">
          To
          <input
            type="number"
            min={1}
            max={pageCount || 999}
            className="w-12 rounded border px-1"
            style={{ background: "var(--common-bg-color)", borderColor: "var(--common-border-color)" }}
            value={pageEnd}
            onChange={(e) => setPageEnd(parseInt(e.target.value, 10) || 1)}
          />
        </label>
        <button type="button" className="underline" style={{ color: "var(--common-text-color)" }} onClick={applyPin}>
          Save range
        </button>
      </div>

      {err && <p className="px-2 text-xs text-red-600">{err}</p>}

      {loading && (
        <div className="flex flex-1 flex-col gap-2 px-3 py-4">
          <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
          <div className="mx-auto mt-2 min-h-[180px] w-full max-w-[240px] flex-1 animate-pulse rounded-md bg-muted" />
          <p className="text-center text-2xs text-muted-foreground">Loading PDF…</p>
        </div>
      )}

      {!loading && !err && pdfDoc && (
        <div className="pad-material__body flex min-h-0 flex-1 flex-row gap-0">
          <nav
            className="pad-material__rail flex shrink-0 flex-col items-center gap-1 border-r border-border px-1 py-2"
            aria-label="PDF tools"
          >
            {railBtn(
              "Previous page",
              <ChevronLeft data-icon="inline-start" />,
              { onClick: () => setPage((p) => Math.max(1, p - 1)), disabled: page <= 1 || pageBusy }
            )}
            {railBtn(
              "Next page",
              <ChevronRight data-icon="inline-start" />,
              { onClick: () => setPage((p) => Math.min(pageCount || 1, p + 1)), disabled: page >= (pageCount || 1) || pageBusy }
            )}
            <div className="my-1 h-px w-6 bg-border" />
            {railBtn(
              "Fit slide width (good for decks)",
              <AlignHorizontalJustifyCenter data-icon="inline-start" />,
              {
                variant: zoomMode === "slide" ? "secondary" : "ghost",
                onClick: () => setZoomMode("slide"),
              }
            )}
            {railBtn(
              "Fit whole page in panel",
              <Maximize2 data-icon="inline-start" />,
              {
                variant: zoomMode === "page" ? "secondary" : "ghost",
                onClick: () => setZoomMode("page"),
              }
            )}
            {railBtn("Zoom in", <ZoomIn data-icon="inline-start" />, { onClick: () => bumpZoom(0.12) })}
            {railBtn("Zoom out", <ZoomOut data-icon="inline-start" />, { onClick: () => bumpZoom(-0.12) })}
            <div className="my-1 h-px w-6 bg-border" />
            {railBtn(
              "Quote selected text into note",
              <MessageSquareQuote data-icon="inline-start" />,
              { onClick: quoteSelection }
            )}
            {railBtn(
              "Yellow marker — draw on the page",
              <Highlighter data-icon="inline-start" />,
              {
                variant: interactMode === "highlight" ? "secondary" : "ghost",
                onClick: () => setInteractMode((m) => (m === "highlight" ? "select" : "highlight")),
              }
            )}
            {railBtn("Clear marker strokes", <Eraser data-icon="inline-start" />, { onClick: clearHighlights })}
            {railBtn(
              "Drag a rectangle — clip into note",
              <Crop data-icon="inline-start" />,
              {
                variant: interactMode === "clip" ? "secondary" : "ghost",
                onClick: () => setInteractMode((m) => (m === "clip" ? "select" : "clip")),
              }
            )}
            {railBtn("Insert full page as image", <ImagePlus data-icon="inline-start" />, { onClick: grabFullPageThumb })}
          </nav>

          <div
            ref={wrapRef}
            className={`pad-material__canvas-wrap relative max-h-[55vh] min-h-0 min-w-0 flex-1 overflow-auto lg:max-h-none ${
              interactMode === "clip" ? "cursor-crosshair" : ""
            }`}
            onPointerDown={onClipPointerDown}
            onPointerMove={onClipPointerMove}
            onPointerUp={onClipPointerUp}
            onPointerCancel={onClipPointerUp}
          >
            {pageBusy && (
              <div className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center bg-background/40">
                <span className="rounded-md border bg-background px-2 py-1 text-2xs shadow-sm">Rendering…</span>
              </div>
            )}
            <div className="pad-material__page-inner relative mx-auto flex w-max max-w-full justify-center p-3">
              <div
                className={`relative shadow-paper ${interactMode === "highlight" ? "cursor-crosshair" : ""}`}
                style={{ touchAction: interactMode === "highlight" ? "none" : undefined }}
              >
                <canvas ref={canvasRef} className="block bg-white" />
                <div
                  ref={textLayerRef}
                  className="pad-material__text-layer pointer-events-auto"
                  style={{
                    pointerEvents: interactMode === "select" ? "auto" : "none",
                  }}
                />
                <canvas
                  ref={markerCanvasRef}
                  className="pointer-events-none absolute left-0 top-0 block"
                  style={{
                    pointerEvents: interactMode === "highlight" ? "auto" : "none",
                  }}
                  onPointerDown={onMarkerPointerDown}
                  onPointerMove={onMarkerPointerMove}
                  onPointerUp={onMarkerPointerUp}
                  onPointerLeave={onMarkerPointerUp}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {interactMode === "clip" && clipBox && Math.abs(clipBox.x2 - clipBox.x1) > 2 && Math.abs(clipBox.y2 - clipBox.y1) > 2 ? (
        <div
          className="pointer-events-none fixed z-[40] border-2 border-primary bg-primary/15"
          style={{
            left: Math.min(clipBox.x1, clipBox.x2),
            top: Math.min(clipBox.y1, clipBox.y2),
            width: Math.abs(clipBox.x2 - clipBox.x1),
            height: Math.abs(clipBox.y2 - clipBox.y1),
          }}
        />
      ) : null}
    </aside>
  )
}

import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"
import { HiOutlineArrowLeft, HiOutlineTrash, HiOutlineUsers } from "react-icons/hi"
import { useAuth } from "../../hooks/useAuth"
import { classroomService } from "../../services/classroomService"
import { useClassroomStore } from "../../store/classroomStore"
import { useWorkspaceStore } from "../../store/workspaceStore"
import { useFolderStore } from "../../store/folderStore"
import type { IClassroom } from "../../types"
import SubmissionsDashboard from "../SubmissionsDashboard"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  buildPresenceTiles,
  ClassroomInquiriesDemo,
  ClassroomPresenceGrid,
  ClassroomPresenceLegend,
} from "./ClassroomOverviewDemo"
import { ClassroomMaterialsPanel } from "./ClassroomMaterialsPanel"
import { ClassroomWorksheetsPanel } from "./ClassroomWorksheetsPanel"
import { ClassroomStudentAssignmentsPanel } from "./ClassroomStudentAssignmentsPanel"
import { ClassroomStudentClassWorkspaceLibrary } from "./ClassroomStudentClassWorkspaceLibrary"
import "./ClassroomHub.css"

type HubTab = "overview" | "worksheets" | "materials" | "submissions" | "assignments"

function hubTabFromSearch(raw: string | null, isTeacher: boolean): HubTab {
  if (isTeacher) {
    if (raw === "submissions" || raw === "worksheets" || raw === "materials") return raw
    return "overview"
  }
  if (raw === "assignments") return "assignments"
  return "overview"
}

export default function ClassroomHub() {
  const { classroomId } = useParams<{ classroomId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const setSelectedFolderId = useWorkspaceStore((s) => s.setSelectedFolderId)
  const setMediumFilter = useWorkspaceStore((s) => s.setMediumFilter)
  const { fetchMembers, members, membersLoading, removeMember } = useClassroomStore()
  const fetchFolders = useFolderStore((s) => s.fetchFolders)

  const [classroom, setClassroom] = useState<IClassroom | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadingClass, setLoadingClass] = useState(true)

  const distributionId = searchParams.get("distribution") || undefined

  const goLibraryHome = useCallback(() => {
    setSelectedFolderId(null)
    setMediumFilter("all")
    navigate("/app/pad")
  }, [navigate, setMediumFilter, setSelectedFolderId])

  const refreshClassroomFromServer = useCallback(() => {
    if (!classroomId) return
    void classroomService.getClassroom(classroomId).then(setClassroom).catch(() => {
      /* hub already handles load errors */
    })
  }, [classroomId])

  const setTab = useCallback(
    (next: HubTab) => {
      const sp = new URLSearchParams(searchParams)
      if (next === "overview") {
        sp.delete("tab")
        sp.delete("distribution")
      } else {
        sp.set("tab", next)
        if (next !== "submissions") sp.delete("distribution")
      }
      setSearchParams(sp, { replace: true })
    },
    [searchParams, setSearchParams]
  )

  useEffect(() => {
    if (!user?.uid || !classroomId) {
      setLoadingClass(false)
      return
    }
    let cancelled = false
    setLoadingClass(true)
    setLoadError(null)
    setClassroom(null)
    void (async () => {
      try {
        const list = await classroomService.listAccessibleClassrooms(user.uid)
        if (cancelled) return
        const match = list.find((c) => c.id === classroomId)
        if (!match) {
          setLoadError("You do not have access to this classroom, or it does not exist.")
          setLoadingClass(false)
          return
        }
        const full = await classroomService.getClassroom(classroomId)
        if (cancelled) return
        setClassroom(full)
        await fetchMembers(classroomId)
      } catch {
        if (!cancelled) setLoadError("Could not load this classroom.")
      } finally {
        if (!cancelled) setLoadingClass(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user?.uid, classroomId, fetchMembers])

  /** Mirror the teacher class tree in the student's library: class workspace → Materials, Worksheets. */
  useEffect(() => {
    if (!user?.uid || !classroom || user.role !== "student") return
    let cancelled = false
    void (async () => {
      try {
        await classroomService.ensureStudentClassWorkspace(user.uid, classroom)
        if (!cancelled) await fetchFolders(user.uid)
      } catch {
        /* folder collection or permissions may block — hub still usable */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user?.uid, user?.role, classroom, fetchFolders])

  const canManageMembers = user?.role === "teacher" || user?.role === "admin"
  const isTeacherOrAdmin = user?.role === "teacher" || user?.role === "admin"
  const isStudent = user?.role === "student"

  const activeStudents = useMemo(
    () => members.filter((m) => m.role === "student" && m.status === "active"),
    [members]
  )

  const presenceTiles = useMemo(
    () => buildPresenceTiles(activeStudents.map((m) => ({ id: m.id, userId: m.userId }))),
    [activeStudents]
  )

  if (!user) return null

  const tab = hubTabFromSearch(searchParams.get("tab"), isTeacherOrAdmin)

  return (
    <main className="pad-home classroom-hub" aria-labelledby="classroom-hub-title">
      <div className="classroom-hub__masthead">
        <button type="button" className="pad-home__back" onClick={goLibraryHome}>
          <HiOutlineArrowLeft className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
          Library
        </button>
        <div>
          <h1 id="classroom-hub-title" className="classroom-hub__name">
            {classroom?.name ?? (loadingClass ? "…" : "Classroom")}
          </h1>
          {classroom?.subject ? <p className="classroom-hub__subject">{classroom.subject}</p> : null}
        </div>
      </div>

      {loadError ? <p className="classroom-hub__error">{loadError}</p> : null}

      {!loadError && classroom && (
        <>
          {(isTeacherOrAdmin || isStudent) && (
            <div className="classroom-hub__toolbar" role="tablist" aria-label="Class views">
              <div className="classroom-hub__seg">
                {isTeacherOrAdmin
                  ? (
                      [
                        ["overview", "Overview"],
                        ["worksheets", "Worksheets"],
                        ["materials", "Materials"],
                        ["submissions", "Submissions"],
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        role="tab"
                        aria-selected={tab === id}
                        className={cn("classroom-hub__seg-btn", tab === id && "classroom-hub__seg-btn--on")}
                        onClick={() => setTab(id)}
                      >
                        {label}
                      </button>
                    ))
                  : (
                      [
                        ["overview", "Overview"],
                        ["assignments", "Assignments"],
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        role="tab"
                        aria-selected={tab === id}
                        className={cn("classroom-hub__seg-btn", tab === id && "classroom-hub__seg-btn--on")}
                        onClick={() => setTab(id)}
                      >
                        {label}
                      </button>
                    ))}
              </div>
            </div>
          )}

          {tab === "overview" && (
            <div className="classroom-hub__stack">
              {isTeacherOrAdmin ? (
                <div className="classroom-hub__overview-layout">
                  <section className="classroom-hub__card" aria-labelledby="pulse-heading">
                    <h2 id="pulse-heading" className="classroom-hub__card-title">
                      Class pulse
                    </h2>
                    <p className="classroom-hub__hint">
                      Each tile is a learner in this class. Most tiles read “in PAD”; a few show a quick tutor ping
                      (hover a tile for detail).
                    </p>
                    <ClassroomPresenceGrid tiles={presenceTiles} />
                    <ClassroomPresenceLegend />
                  </section>
                  <aside className="classroom-hub__card classroom-hub__aside" aria-labelledby="inquiries-heading">
                    <h2 id="inquiries-heading" className="classroom-hub__card-title">
                      Top questions
                    </h2>
                    <p className="classroom-hub__hint">
                      Recent prompts to the tutor from <strong>{classroom.subject || "Math 7A"}</strong> (right
                      triangles / hypotenuse).
                    </p>
                    <ClassroomInquiriesDemo />
                  </aside>
                </div>
              ) : (
                <>
                  <ClassroomStudentAssignmentsPanel
                    classroomId={classroom.id}
                    pendingOnly
                    embedded
                    title="Not submitted yet"
                    lede="These worksheets still need to be turned in. Continue opens your draft. The Assignments tab lists everything for this class, including work you have already turned in."
                  />
                  <section className="classroom-hub__card">
                    <h2 className="classroom-hub__card-title">Your class</h2>
                    <p className="classroom-hub__hint">
                      Use the library for other notes shared with this class. Open <strong>Assignments</strong> for
                      the full worksheet list.
                    </p>
                  </section>
                </>
              )}

              {(isTeacherOrAdmin || activeStudents.length > 0) && (
                <details className="classroom-hub__details">
                  <summary className="classroom-hub__details-summary">Roster</summary>
                  <div className="classroom-hub__details-body">
                    <h2 className="classroom-hub__roster-head">
                      <HiOutlineUsers className="h-3.5 w-3.5 opacity-70" aria-hidden />
                      Students ({membersLoading ? "…" : activeStudents.length})
                    </h2>
                    {membersLoading ? (
                      <p className="classroom-hub__empty">Loading roster…</p>
                    ) : activeStudents.length === 0 ? (
                      <p className="classroom-hub__empty">
                        No students yet. Rosters are often managed by your school administrator.
                      </p>
                    ) : (
                      <ul className="classroom-hub__roster">
                        {activeStudents.map((m) => (
                          <li key={m.id} className="classroom-hub__member">
                            <div className="classroom-hub__member-avatar" aria-hidden>
                              {m.userId.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="classroom-hub__member-body">
                              <span className="classroom-hub__member-id" title={m.userId}>
                                {m.userId}
                              </span>
                              <span className="classroom-hub__member-role">{m.role}</span>
                            </div>
                            {canManageMembers ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                                onClick={() => void removeMember(m.id)}
                                aria-label={`Remove student ${m.userId}`}
                              >
                                <HiOutlineTrash className="h-4 w-4" />
                              </Button>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </details>
              )}
            </div>
          )}

          {tab === "assignments" && isStudent && (
            <ClassroomStudentAssignmentsPanel classroomId={classroom.id} />
          )}

          {tab === "worksheets" && isTeacherOrAdmin && (
            <ClassroomWorksheetsPanel
              classroomId={classroom.id}
              onOpenLibrary={goLibraryHome}
              onAfterProvision={refreshClassroomFromServer}
            />
          )}

          {tab === "materials" && isTeacherOrAdmin && user?.uid && (
            <ClassroomMaterialsPanel
              classroom={classroom}
              teacherId={user.uid}
              onOpenLibrary={goLibraryHome}
              onRefreshClassroom={refreshClassroomFromServer}
            />
          )}

          {tab === "submissions" && isTeacherOrAdmin && (
            <div className="classroom-hub__submissions">
              <SubmissionsDashboard
                classroomIdFilter={classroom.id}
                embedded
                initialDistributionId={distributionId}
              />
            </div>
          )}

          {isStudent && (
            <ClassroomStudentClassWorkspaceLibrary classroomId={classroom.id} classroomName={classroom.name} />
          )}
        </>
      )}

      {loadingClass && !loadError ? <div className="classroom-hub__loading">Loading…</div> : null}
    </main>
  )
}

import React, { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../../hooks/useAuth"
import { getUserProfile } from "../../services/roleService"
import { classroomService } from "../../services/classroomService"
import type { IClassroom, IClassroomMembership } from "../../types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useClassroomStore } from "../../store/classroomStore"

export default function AdminClassroomRoster() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [schoolId, setSchoolId] = useState<string | null>(null)
  const [classrooms, setClassrooms] = useState<IClassroom[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [members, setMembers] = useState<IClassroomMembership[]>([])
  const [studentIdInput, setStudentIdInput] = useState("")
  const [moveToId, setMoveToId] = useState("")
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user?.uid) return
    setLoading(true)
    setErr(null)
    try {
      const profile = await getUserProfile(user.uid)
      const sid = profile?.schoolId?.trim() || null
      setSchoolId(sid)
      if (!sid) {
        setClassrooms([])
        setErr("No schoolId on your user profile — set school in user_profiles before managing rosters.")
        return
      }
      const list = await classroomService.listClassroomsBySchool(sid)
      setClassrooms(list)
      setSelectedId((prev) => {
        if (prev && list.some((c) => c.id === prev)) return prev
        return list[0]?.id ?? null
      })
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load classrooms")
    } finally {
      setLoading(false)
    }
  }, [user?.uid])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!selectedId) {
      setMembers([])
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const m = await classroomService.listMembers(selectedId)
        if (!cancelled) setMembers(m)
      } catch {
        if (!cancelled) setMembers([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedId])

  const selected = classrooms.find((c) => c.id === selectedId) ?? null

  const onAddStudent = async () => {
    if (!selected || !schoolId) return
    const sid = studentIdInput.trim()
    if (!sid) return
    setBusy(true)
    setErr(null)
    try {
      await classroomService.adminAddStudentMembership({
        studentUserId: sid,
        classroomId: selected.id,
        schoolId,
      })
      setStudentIdInput("")
      const m = await classroomService.listMembers(selected.id)
      setMembers(m)
      if (user?.uid) await useClassroomStore.getState().refreshClassroomsAndMembers(user.uid)
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Add failed")
    } finally {
      setBusy(false)
    }
  }

  const onMoveStudent = async (studentUserId: string) => {
    if (!selected || !schoolId || !moveToId.trim()) return
    setBusy(true)
    setErr(null)
    try {
      await classroomService.adminMoveStudentBetweenClassrooms({
        studentUserId,
        fromClassroomId: selected.id,
        toClassroomId: moveToId.trim(),
        toSchoolId: schoolId,
      })
      const m = await classroomService.listMembers(selected.id)
      setMembers(m)
      if (user?.uid) await useClassroomStore.getState().refreshClassroomsAndMembers(user.uid)
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Move failed")
    } finally {
      setBusy(false)
    }
  }

  if (!user || user.role !== "admin") {
    return (
      <div className="flex flex-col gap-4 p-6">
        <p className="text-sm text-muted-foreground">Admins only.</p>
        <Button type="button" variant="outline" onClick={() => navigate("/app/pad")}>
          Back
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-3xl">
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold">Admin — classroom rosters</h1>
        <p className="text-sm text-muted-foreground">
          Add or move students without invite codes. Requires `schoolId` on your profile and matching `classrooms`
          rows.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            Refresh
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => navigate("/app/pad#pad-home-classes")}>
            Classrooms UI
          </Button>
        </div>
      </div>

      {err && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {err}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Classroom</span>
            <select
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={selectedId ?? ""}
              onChange={(e) => setSelectedId(e.target.value || null)}
            >
              {classrooms.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.id.slice(0, 6)}…)
                </option>
              ))}
            </select>
          </label>

          {selected && (
            <div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium">Add student (Appwrite user id)</span>
                <div className="flex flex-wrap gap-2 items-end">
                  <Input
                    className="max-w-md"
                    placeholder="Student user id"
                    value={studentIdInput}
                    onChange={(e) => setStudentIdInput(e.target.value)}
                  />
                  <Button type="button" onClick={() => void onAddStudent()} disabled={busy}>
                    Add to class
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium">Members ({members.filter((m) => m.status === "active").length})</span>
                <ul className="flex flex-col gap-1 max-h-56 overflow-y-auto text-sm">
                  {members
                    .filter((m) => m.status === "active")
                    .map((m) => (
                      <li
                        key={m.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded border border-border px-2 py-1"
                      >
                        <span className="font-mono text-xs">{m.userId}</span>
                        <span className="text-muted-foreground">{m.role}</span>
                        {m.role === "student" && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            onClick={() => void onMoveStudent(m.userId)}
                          >
                            Move (use target below)
                          </Button>
                        )}
                      </li>
                    ))}
                </ul>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium">Move target classroom id</span>
                <Input
                  placeholder="Target classroom $id"
                  value={moveToId}
                  onChange={(e) => setMoveToId(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

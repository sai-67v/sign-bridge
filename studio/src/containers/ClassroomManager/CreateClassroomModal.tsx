import React, { useState } from "react"
import { useClassroomStore } from "../../store/classroomStore"
import type { IClassroom } from "../../types"

export function CreateClassroomModal({
  schoolId,
  teacherId,
  onClose,
  onCreated,
}: {
  schoolId: string
  teacherId: string
  onClose: () => void
  onCreated: (c: IClassroom) => void
}) {
  const { createClassroom } = useClassroomStore()
  const [form, setForm] = useState({ name: "", subject: "", gradeLevel: "", description: "" })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const classroom = await createClassroom(teacherId, { ...form, schoolId })
      onCreated(classroom)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">Create Classroom</h2>
        <form className="modal-form" onSubmit={handleSubmit}>
          <label>
            Name *
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Math 7A"
            />
          </label>
          <label>
            Subject
            <input
              value={form.subject}
              onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
              placeholder="e.g. Mathematics"
            />
          </label>
          <label>
            Grade Level
            <input
              value={form.gradeLevel}
              onChange={(e) => setForm((f) => ({ ...f, gradeLevel: e.target.value }))}
              placeholder="e.g. Grade 7"
            />
          </label>
          <label>
            Description
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
            />
          </label>
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

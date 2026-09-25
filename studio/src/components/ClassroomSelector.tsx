import React, { useEffect } from "react"
import { useAuth } from "../hooks/useAuth"
import { useClassroomStore } from "../store/classroomStore"

export default function ClassroomSelector() {
  const { user } = useAuth()
  const { myClassrooms, currentClassroom, loading, fetchMyClassrooms, selectClassroom } = useClassroomStore()

  useEffect(() => {
    if (user?.uid && myClassrooms.length === 0 && !loading) {
      fetchMyClassrooms(user.uid)
    }
  }, [user?.uid, myClassrooms.length, loading, fetchMyClassrooms])

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const chosen = myClassrooms.find((c) => c.id === e.target.value) || null
    selectClassroom(chosen)
  }

  return (
    <select
      className="classroom-selector sidebar-classroom-selector"
      value={currentClassroom?.id || ""}
      onChange={handleChange}
      title="Select active classroom"
    >
      <option value="">Select classroom…</option>
      {myClassrooms.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  )
}

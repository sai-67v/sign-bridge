import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useClassroomStore } from '../../store/classroomStore';
import { worksheetService } from '../../services/worksheetService';
import { classroomService } from '../../services/classroomService';
import type { IPad } from '../../services/pads';
import '../ClassroomManager/ClassroomManager.css';

interface DistributeModalProps {
  pad: IPad;
  onClose: () => void;
}

export default function DistributeModal({ pad, onClose }: DistributeModalProps) {
  const { user } = useAuth();
  const { myClassrooms, currentClassroom, fetchMyClassrooms } = useClassroomStore();
  const [selectedClassroomId, setSelectedClassroomId] = useState('');
  const [studentCount, setStudentCount] = useState<number | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (user?.uid) fetchMyClassrooms(user.uid);
  }, [user?.uid]);

  // Pre-select the classroom already chosen in the navbar
  useEffect(() => {
    if (currentClassroom?.id && myClassrooms.some(c => c.id === currentClassroom.id)) {
      setSelectedClassroomId(currentClassroom.id);
    }
  }, [currentClassroom?.id, myClassrooms]);

  useEffect(() => {
    if (!selectedClassroomId) {
      setStudentCount(null);
      return;
    }
    classroomService.listMembers(selectedClassroomId).then((members) => {
      const students = members.filter((m) => m.role === 'student' && m.status === 'active');
      setStudentCount(students.length);
    }).catch(() => setStudentCount(null));
  }, [selectedClassroomId]);

  const handleDistribute = async () => {
    if (!selectedClassroomId || !user?.uid) return;
    setStatus('loading');
    try {
      let worksheetId = pad.id;

      // Create (or ensure) a worksheet record in the worksheets collection
      try {
        const ws = await worksheetService.createWorksheet(user.uid, {
          title: pad.title,
          content: pad.content || '',
          worksheetSections: pad.worksheetSections ? JSON.stringify(pad.worksheetSections) : undefined,
          classroomId: selectedClassroomId,
        });
        worksheetId = ws.id;
      } catch {
        // If creating worksheet fails, use the pad id as fallback
        worksheetId = pad.id;
      }

      await worksheetService.distribute(
        worksheetId,
        selectedClassroomId,
        user.uid,
        user.displayName || 'Teacher',
      );

      setStatus('success');
      setTimeout(onClose, 1500);
    } catch (err: any) {
      setStatus('error');
      setErrorMsg(err?.message || 'Distribution failed');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box distribute-modal" onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">📤 Send to Class</h2>
        <p className="distribute-subtitle">
          Send <strong>"{pad.title}"</strong> to all students in a classroom.
        </p>

        {status === 'success' ? (
          <div className="distribute-success">
            ✅ Worksheet sent! Students have been notified.
          </div>
        ) : (
          <>
            {myClassrooms.length === 0 ? (
              <div className="distribute-empty">
                No classrooms found. Create a classroom first from the Teacher Dashboard.
              </div>
            ) : (
              <div className="distribute-form">
                <label className="distribute-label">
                  Select Classroom
                  <select
                    className="distribute-select"
                    value={selectedClassroomId}
                    onChange={e => setSelectedClassroomId(e.target.value)}
                    aria-label="Select classroom"
                  >
                    <option value="">— Choose a classroom —</option>
                    {myClassrooms.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name}{c.subject ? ` (${c.subject})` : ''}
                      </option>
                    ))}
                  </select>
                </label>
                {selectedClassroomId && studentCount !== null && (
                  <p className="distribute-student-count" style={{ color: 'var(--editor-text-secondary)', fontSize: 14, margin: 0 }}>
                    {studentCount} {studentCount === 1 ? 'student' : 'students'} will receive this.
                  </p>
                )}
                {status === 'error' && <p className="distribute-error">{errorMsg}</p>}
              </div>
            )}
            <div className="modal-actions distribute-modal-actions">
              <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
              <button
                type="button"
                className="btn-primary distribute-send-btn"
                onClick={handleDistribute}
                disabled={!selectedClassroomId || status === 'loading'}
              >
                {status === 'loading' ? 'Sending…' : 'Send'}
              </button>
            </div>
            <p className="distribute-print-link">
              <button
                type="button"
                className="distribute-print-btn"
                onClick={() => { window.print(); onClose(); }}
                aria-label="Print for yourself"
              >
                Print for yourself
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

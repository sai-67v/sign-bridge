import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HiOutlinePlus, HiOutlineUsers, HiOutlineTrash } from 'react-icons/hi';
import { useAuth } from '../../hooks/useAuth';
import { useClassroomStore } from '../../store/classroomStore';
import type { IClassroom, IClassroomMembership } from '../../types';
import { CreateClassroomModal } from './CreateClassroomModal';
import './ClassroomManager.css';

export function MemberRow({ member, onRemove }: { member: IClassroomMembership; onRemove: (id: string) => void }) {
  return (
    <div className="member-row">
      <div className="member-avatar">{member.userId.slice(0, 2).toUpperCase()}</div>
      <div className="member-info">
        <span className="member-id">{member.userId}</span>
        <span className={`member-role role-${member.role}`}>{member.role}</span>
      </div>
      <button className="member-remove" onClick={() => onRemove(member.id)} title="Remove member">
        <HiOutlineTrash size={14} />
      </button>
    </div>
  );
}

function ClassroomCard({ classroom, onSelect }: { classroom: IClassroom; onSelect: (c: IClassroom) => void }) {
  return (
    <div className="classroom-card" onClick={() => onSelect(classroom)}>
      <div className="classroom-card-header">
        <div className="classroom-name">{classroom.name}</div>
        {classroom.subject && <span className="classroom-subject">{classroom.subject}</span>}
      </div>
      {classroom.gradeLevel && <div className="classroom-grade">{classroom.gradeLevel}</div>}
      <p className="cm-empty-small" style={{ marginTop: 8 }}>
        Rosters are managed by an administrator; students no longer join with a code.
      </p>
    </div>
  );
}

export default function ClassroomManager() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { myClassrooms, currentClassroom, members, loading, membersLoading, fetchMyClassrooms, selectClassroom, fetchMembers, removeMember, updateClassroom } = useClassroomStore();
  const [creating, setCreating] = useState(false);
  const [rootFolderDraft, setRootFolderDraft] = useState('');

  useEffect(() => {
    if (currentClassroom) setRootFolderDraft(currentClassroom.rootFolderId || '');
  }, [currentClassroom?.id, currentClassroom?.rootFolderId]);

  useEffect(() => {
    if (user?.uid) fetchMyClassrooms(user.uid);
  }, [user?.uid]);

  useEffect(() => {
    if (currentClassroom) fetchMembers(currentClassroom.id);
  }, [currentClassroom?.id]);

  if (!user) return null;

  const schoolId = (user as any).schoolId || 'unknown-school';

  return (
    <div className="classroom-manager">
      <div className="cm-header">
        <h1>My Classrooms</h1>
        {(user.role === 'teacher' || user.role === 'admin') && (
          <button className="btn-primary" onClick={() => setCreating(true)}>
            <HiOutlinePlus /> New Classroom
          </button>
        )}
      </div>

      {loading && <div className="cm-loading">Loading classrooms…</div>}

      <div className="cm-layout">
        <div className="cm-list">
          {myClassrooms.map(c => (
            <ClassroomCard key={c.id} classroom={c} onSelect={selectClassroom} />
          ))}
          {!loading && myClassrooms.length === 0 && (
            <div className="cm-empty">
              <p>No classrooms yet. Create your first one!</p>
            </div>
          )}
        </div>

        {currentClassroom && (
          <div className="cm-detail">
            <div className="cm-detail-header">
              <h2>{currentClassroom.name}</h2>
              <div className="cm-detail-actions">
                <button
                  className="btn-secondary"
                  onClick={() =>
                    navigate(`/app/pad/classroom/${currentClassroom.id}?tab=submissions`)
                  }
                >
                  📊 Submissions
                </button>
              </div>
            </div>

            {currentClassroom.teacherId === user.uid && (
              <div className="cm-library-root" style={{ marginBottom: '1rem' }}>
                <h3>Class library root</h3>
                <p className="cm-empty-small">
                  Set the PAD <strong>folders</strong> document id that anchors this class workspace. Teacher PDF uploads from class pads then go to a <strong>Materials</strong> subfolder under this root.
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <input
                    style={{
                      flex: '1 1 220px',
                      minWidth: 120,
                      padding: '8px 10px',
                      borderRadius: 6,
                      border: '1px solid var(--common-border-color, #ccc)',
                      background: 'var(--common-bg-color, #fff)',
                    }}
                    value={rootFolderDraft}
                    onChange={(e) => setRootFolderDraft(e.target.value)}
                    placeholder="Folder document id (from Library)"
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={async () => {
                      const v = rootFolderDraft.trim();
                      await updateClassroom(currentClassroom.id, { rootFolderId: v ? v : null });
                    }}
                  >
                    Save root
                  </button>
                </div>
              </div>
            )}

            <div className="cm-members-section">
              <h3><HiOutlineUsers /> Students ({membersLoading ? '…' : members.filter(m => m.role === 'student').length})</h3>
              {membersLoading && <div className="cm-loading">Loading members…</div>}
              {members.filter(m => m.role === 'student').map(m => (
                <MemberRow key={m.id} member={m} onRemove={removeMember} />
              ))}
              {!membersLoading && members.filter(m => m.role === 'student').length === 0 && (
                <p className="cm-empty-small">
                  No students yet. Ask your administrator to add enrollments, or add members from the teacher tools
                  where your Appwrite rules allow it.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {creating && (
        <CreateClassroomModal
          schoolId={schoolId}
          teacherId={user.uid}
          onClose={() => setCreating(false)}
          onCreated={(c) => { setCreating(false); selectClassroom(c); }}
        />
      )}
    </div>
  );
}

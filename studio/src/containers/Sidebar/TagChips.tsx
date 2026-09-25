import React, { useEffect, useState } from 'react';
import { HiOutlineTag, HiOutlinePlus, HiOutlineX } from 'react-icons/hi';
import { useAuth } from '../../hooks/useAuth';
import { useTagStore } from '../../store/tagStore';

const TAG_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'];

export default function TagChips() {
  const { user } = useAuth();
  const { tags, activeTagIds, loading, fetchTags, toggleActiveTag, createTag, deleteTag } = useTagStore();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(TAG_COLORS[4]);

  useEffect(() => {
    if (user?.uid) fetchTags(user.uid);
  }, [user?.uid]);

  const handleAdd = async () => {
    if (!newName.trim() || !user?.uid) return;
    await createTag(user.uid, { name: newName.trim(), color: newColor });
    setNewName('');
    setAdding(false);
  };

  return (
    <section className="sec-container">
      <h2 className="sec-title">
        <HiOutlineTag />
        <span>Tags</span>
        <button
          className="sec-title-action"
          onClick={() => setAdding(v => !v)}
          title="New tag"
        >
          <HiOutlinePlus />
        </button>
      </h2>
      <div className="sec-content">
        {adding && (
          <div className="tag-add-row">
            <input
              autoFocus
              className="folder-add-input"
              placeholder="Tag name"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setAdding(false); }}
            />
            <div className="tag-color-picker">
              {TAG_COLORS.map(c => (
                <button
                  key={c}
                  className={`tag-color-dot ${newColor === c ? 'selected' : ''}`}
                  style={{ background: c }}
                  onClick={() => setNewColor(c)}
                />
              ))}
            </div>
          </div>
        )}
        {loading && <div className="sec-loading">Loading…</div>}
        <div className="tag-chips">
          {tags.map(tag => {
            const isActive = activeTagIds.includes(tag.id);
            return (
              <div key={tag.id} className={`tag-chip ${isActive ? 'active' : ''}`}>
                <span
                  className="tag-chip-inner"
                  style={{ borderColor: tag.color || '#6b7280', color: isActive ? '#fff' : undefined, background: isActive ? (tag.color || '#6b7280') : undefined }}
                  onClick={() => toggleActiveTag(tag.id)}
                >
                  {tag.name}
                </span>
                <button
                  className="tag-chip-delete"
                  onClick={() => deleteTag(tag.id)}
                  title="Delete tag"
                >
                  <HiOutlineX size={10} />
                </button>
              </div>
            );
          })}
          {!loading && tags.length === 0 && !adding && (
            <div className="sec-empty">No tags yet</div>
          )}
        </div>
      </div>
    </section>
  );
}

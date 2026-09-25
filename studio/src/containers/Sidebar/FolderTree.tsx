import React, { useEffect, useMemo, useState } from "react"
import { HiOutlineFolder, HiOutlineFolderOpen, HiOutlinePlus, HiOutlineTrash } from "react-icons/hi"
import { useAuth } from "../../hooks/useAuth"
import { useFolderStore } from "../../store/folderStore"
import type { IFolder } from "../../types"

function FolderRow({
  folder,
  depth,
  hasChildren,
  isOpen,
  onToggleOpen,
  activeFolderId,
  onSelect,
  onDelete,
}: {
  folder: IFolder
  depth: number
  hasChildren: boolean
  isOpen: boolean
  onToggleOpen: () => void
  activeFolderId: string | null
  onSelect: (id: string | null) => void
  onDelete: (id: string) => void
}) {
  const isActive = activeFolderId === folder.id
  const colorStyle = folder.color ? { color: folder.color } : {}

  return (
    <div
      className={`folder-item ${isActive ? "active" : ""}`}
      style={{ paddingLeft: `${12 + depth * 14}px` }}
    >
      <div className="folder-row" onClick={() => onSelect(isActive ? null : folder.id)}>
        {hasChildren ? (
          <button
            type="button"
            className="folder-chevron"
            aria-expanded={isOpen}
            aria-label={isOpen ? "Collapse" : "Expand"}
            onClick={(e) => {
              e.stopPropagation()
              onToggleOpen()
            }}
          >
            {isOpen ? "▾" : "▸"}
          </button>
        ) : (
          <span className="folder-chevron folder-chevron--spacer" aria-hidden />
        )}
        <span style={colorStyle}>
          {isActive ? <HiOutlineFolderOpen /> : <HiOutlineFolder />}
        </span>
        <span className="folder-name">{folder.name}</span>
      </div>
      <button
        className="folder-delete"
        onClick={(e) => {
          e.stopPropagation()
          onDelete(folder.id)
        }}
        aria-label={`Delete ${folder.name}`}
      >
        <HiOutlineTrash size={12} />
      </button>
    </div>
  )
}

function FolderBranch({
  folder,
  allFolders,
  depth,
  expanded,
  setExpanded,
  activeFolderId,
  onSelect,
  onDelete,
}: {
  folder: IFolder
  allFolders: IFolder[]
  depth: number
  expanded: Record<string, boolean>
  setExpanded: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  activeFolderId: string | null
  onSelect: (id: string | null) => void
  onDelete: (id: string) => void
}) {
  const children = useMemo(
    () => allFolders.filter((f) => f.parentFolderId === folder.id).sort((a, b) => a.name.localeCompare(b.name)),
    [allFolders, folder.id]
  )
  const hasChildren = children.length > 0
  const isOpen = expanded[folder.id] !== false

  return (
    <React.Fragment key={folder.id}>
      <FolderRow
        folder={folder}
        depth={depth}
        hasChildren={hasChildren}
        isOpen={isOpen}
        onToggleOpen={() =>
          setExpanded((prev) => ({
            ...prev,
            [folder.id]: prev[folder.id] === false ? true : false,
          }))
        }
        activeFolderId={activeFolderId}
        onSelect={onSelect}
        onDelete={onDelete}
      />
      {hasChildren && isOpen
        ? children.map((child) => (
            <FolderBranch
              key={child.id}
              folder={child}
              allFolders={allFolders}
              depth={depth + 1}
              expanded={expanded}
              setExpanded={setExpanded}
              activeFolderId={activeFolderId}
              onSelect={onSelect}
              onDelete={onDelete}
            />
          ))
        : null}
    </React.Fragment>
  )
}

export default function FolderTree() {
  const { user } = useAuth()
  const { folders, activeFolderId, loading, fetchFolders, setActiveFolder, createFolder, deleteFolder } =
    useFolderStore()
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState("")
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (user?.uid) fetchFolders(user.uid)
  }, [user?.uid, fetchFolders])

  const handleAdd = async () => {
    if (!newName.trim() || !user?.uid) return
    await createFolder(user.uid, { name: newName.trim() })
    setNewName("")
    setAdding(false)
  }

  const rootFolders = useMemo(() => folders.filter((f) => !f.parentFolderId), [folders])

  return (
    <section className="sec-container">
      <h2 className="sec-title">
        <HiOutlineFolder />
        <span>Folders</span>
        <button className="sec-title-action" onClick={() => setAdding((v) => !v)} title="New folder">
          <HiOutlinePlus />
        </button>
      </h2>
      <div className="sec-content">
        {adding && (
          <div className="folder-add-row">
            <input
              autoFocus
              className="folder-add-input"
              placeholder="Folder name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleAdd()
                if (e.key === "Escape") setAdding(false)
              }}
            />
          </div>
        )}
        {loading && <div className="sec-loading">Loading…</div>}
        {rootFolders.map((folder) => (
          <FolderBranch
            key={folder.id}
            folder={folder}
            allFolders={folders}
            depth={0}
            expanded={expanded}
            setExpanded={setExpanded}
            activeFolderId={activeFolderId}
            onSelect={setActiveFolder}
            onDelete={deleteFolder}
          />
        ))}
        {!loading && rootFolders.length === 0 && !adding && <div className="sec-empty">No folders yet</div>}
      </div>
    </section>
  )
}

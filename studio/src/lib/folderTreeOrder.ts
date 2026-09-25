import type { IFolder } from "../types"

/** Depth-first order: roots (no parent) first, then each subtree sorted by name. */
export function orderedFolderRowsDepthFirst(folders: IFolder[]): { id: string; depth: number }[] {
  if (!folders?.length) return []
  const byParent = new Map<string | null, IFolder[]>()
  for (const f of folders) {
    const p = f.parentFolderId ?? null
    if (!byParent.has(p)) byParent.set(p, [])
    byParent.get(p)!.push(f)
  }
  for (const arr of byParent.values()) {
    arr.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
  }
  const out: { id: string; depth: number }[] = []
  const walk = (parentId: string | null, depth: number) => {
    for (const f of byParent.get(parentId) ?? []) {
      out.push({ id: f.id, depth })
      walk(f.id, depth + 1)
    }
  }
  walk(null, 0)
  return out
}

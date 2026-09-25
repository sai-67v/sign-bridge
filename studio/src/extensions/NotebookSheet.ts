import { mergeAttributes, Node } from "@tiptap/core"
import type { Node as PMNode, ResolvedPos } from "@tiptap/pm/model"
import { Fragment } from "@tiptap/pm/model"
import type { Selection, Transaction } from "@tiptap/pm/state"
import { EditorState, TextSelection } from "@tiptap/pm/state"
import { splitBlock } from "@tiptap/pm/commands"

function findNotebookSheetFromSelection(selection: Selection) {
  const $from = selection.$from
  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type.name === "notebookSheet") {
      return {
        sheetDepth: d,
        sheetPos: $from.before(d),
        sheetNode: $from.node(d),
      }
    }
  }
  return null
}

/**
 * True when the cursor sits at the first valid position inside the sheet child block that contains it
 * (same as $from.start(sheetDepth + 1)). When deeper (list, table, etc.), splitBlock cannot reach that
 * position — caller should split the sheet using $from.index(sheetDepth) instead of looping.
 */
function atNotebookSheetChildContentStart($from: ResolvedPos, sheetDepth: number): boolean {
  const childDepth = sheetDepth + 1
  if ($from.depth < childDepth) return false
  return $from.pos === $from.start(childDepth)
}

function nestedInsideNotebookSheetChild($from: ResolvedPos, sheetDepth: number): boolean {
  return $from.depth > sheetDepth + 1
}

/** Normalize selection to the start of a direct child block of the current notebook sheet (for a clean page split). */
function normalizeToSheetBlockStart(state: EditorState): EditorState | null {
  let cur = state
  let guard = 0
  while (guard++ < 48) {
    const sheet = findNotebookSheetFromSelection(cur.selection)
    if (!sheet) return null
    const { sheetDepth } = sheet
    const $from = cur.selection.$from
    if (nestedInsideNotebookSheetChild($from, sheetDepth)) return cur
    if (atNotebookSheetChildContentStart($from, sheetDepth)) return cur

    let splitTr: Transaction | undefined
    if (!splitBlock(cur, (t) => { splitTr = t })) return null
    if (!splitTr?.docChanged) return null
    cur = cur.apply(splitTr)
  }
  return null
}

function splitCurrentNotebookSheet(state: EditorState): Transaction | null {
  const sheet = findNotebookSheetFromSelection(state.selection)
  if (!sheet) return null
  const sheetType = state.schema.nodes.notebookSheet
  const paragraph = state.schema.nodes.paragraph
  if (!sheetType || !paragraph) return null

  const { sheetPos, sheetNode, sheetDepth } = sheet
  const $from = state.selection.$from
  const indexInSheet = $from.index(sheetDepth)

  const beforeChildren: PMNode[] = []
  const afterChildren: PMNode[] = []
  for (let i = 0; i < sheetNode.childCount; i++) {
    const child = sheetNode.child(i)
    if (i < indexInSheet) beforeChildren.push(child)
    else afterChildren.push(child)
  }

  const beforeFrag =
    beforeChildren.length > 0 ? Fragment.from(beforeChildren) : Fragment.from(paragraph.create())
  const afterFrag =
    afterChildren.length > 0 ? Fragment.from(afterChildren) : Fragment.from(paragraph.create())

  const new1 = sheetType.create(null, beforeFrag)
  const new2 = sheetType.create(null, afterFrag)

  const tr = state.tr.replaceWith(sheetPos, sheetPos + sheetNode.nodeSize, Fragment.from([new1, new2]))

  const startSecond = sheetPos + new1.nodeSize + 1
  const endDoc = tr.doc.content.size
  const pos = Math.min(Math.max(1, startSecond), endDoc)
  tr.setSelection(TextSelection.near(tr.doc.resolve(pos), 1))

  return tr.scrollIntoView()
}

export const NotebookSheet = Node.create({
  name: "notebookSheet",
  group: "block",
  content: "block+",
  defining: true,
  isolating: true,

  parseHTML() {
    return [
      { tag: 'section[data-notebook-sheet="true"]' },
      { tag: "section[data-notebook-sheet]" },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "section",
      mergeAttributes(HTMLAttributes, {
        "data-notebook-sheet": "true",
        class: "notebook-sheet-page",
      }),
      0,
    ]
  },

  addCommands() {
    return {
      insertNotebookPage:
        () =>
        ({ editor, dispatch }) => {
          if (!dispatch) {
            const normalized = normalizeToSheetBlockStart(editor.state)
            if (!normalized) return false
            return !!splitCurrentNotebookSheet(normalized)
          }

          let cur = editor.state
          let guard = 0
          while (guard++ < 48) {
            const sheet = findNotebookSheetFromSelection(cur.selection)
            if (!sheet) return false
            const { sheetDepth } = sheet
            const $from = cur.selection.$from
            if (nestedInsideNotebookSheetChild($from, sheetDepth)) break
            if (atNotebookSheetChildContentStart($from, sheetDepth)) break

            const splitOk = splitBlock(cur, (t) => dispatch(t))
            if (!splitOk) break
            cur = editor.state
          }

          const tr = splitCurrentNotebookSheet(editor.state)
          if (!tr) return false
          dispatch(tr)
          return true
        },
    }
  },
})

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    notebookSheet: {
      insertNotebookPage: () => ReturnType
    }
  }
}

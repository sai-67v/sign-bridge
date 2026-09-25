import { Node } from "@tiptap/core"

/** Root document: stacked visual pages (NotebookSheet), Word-style. */
export const NotebookDocument = Node.create({
  name: "doc",
  topNode: true,
  content: "notebookSheet+",
})

import { Extension } from "@tiptap/core"

/** Persists data-source-material / data-page on blockquotes for material quotes */
export const BlockquoteSourceAttrs = Extension.create({
  name: "blockquoteSourceAttrs",
  addGlobalAttributes() {
    return [
      {
        types: ["blockquote"],
        attributes: {
          "data-source-material": {
            default: null,
            parseHTML: (element) => element.getAttribute("data-source-material"),
            renderHTML: (attributes) => {
              const v = attributes["data-source-material"] as string | null | undefined
              if (!v) return {}
              return { "data-source-material": v }
            },
          },
          "data-page": {
            default: null,
            parseHTML: (element) => element.getAttribute("data-page"),
            renderHTML: (attributes) => {
              const v = attributes["data-page"] as string | null | undefined
              if (!v) return {}
              return { "data-page": v }
            },
          },
        },
      },
    ]
  },
})

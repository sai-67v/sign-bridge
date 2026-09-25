import { Editor } from "@tiptap/react"
import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

const columns = [1, 2, 3, 4, 5, 6]
const rows = [1, 2, 3, 4, 5, 6, 7, 8]

interface TableDialogProps {
    isOpen: boolean
    onClose: () => void
    editor: Editor | null
}

export function TableDialog({ isOpen, onClose, editor }: TableDialogProps) {
    const [hoveredRow, setHoveredRow] = useState(0)
    const [hoveredCol, setHoveredCol] = useState(0)

    const handleCellClick = (row: number, col: number) => {
        if (editor) {
            editor.chain().focus().insertTable({ rows: row, cols: col, withHeaderRow: true }).run()
            onClose()
        }
    }

    const handleClose = () => {
        setHoveredRow(0)
        setHoveredCol(0)
        onClose()
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose() }}>
            <DialogContent className="border-[color:var(--modal-border-color)] bg-[color:var(--modal-bg-color)] text-[color:var(--common-text-color)] sm:rounded-xl">
                <DialogHeader>
                    <DialogTitle className="text-center">Insert Table</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col items-center">
                    <table className="border-separate border-spacing-1">
                        <tbody>
                            {rows.map((rw) => (
                                <tr key={rw}>
                                    {columns.map((col) => {
                                        const isHighlighted = rw <= hoveredRow && col <= hoveredCol
                                        return (
                                            <td
                                                key={col}
                                                onMouseEnter={() => {
                                                    setHoveredRow(rw)
                                                    setHoveredCol(col)
                                                }}
                                                onClick={() => handleCellClick(rw, col)}
                                                className={`h-6 w-6 cursor-pointer border-2 transition-colors ${isHighlighted
                                                        ? 'border-blue-600 bg-blue-500'
                                                        : 'border-gray-300 bg-gray-100 hover:border-blue-400 dark:border-gray-600 dark:bg-gray-700'
                                                    }`}
                                            />
                                        )
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <p className="mt-4 text-sm text-muted-foreground">
                        {hoveredRow > 0 && hoveredCol > 0
                            ? `${hoveredCol} × ${hoveredRow} table`
                            : 'Hover to select size'}
                    </p>
                </div>
                <DialogFooter className="justify-center sm:justify-center">
                    <Button type="button" variant="outline" onClick={handleClose}>
                        Cancel
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

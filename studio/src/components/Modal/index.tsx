import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Dialog, DialogOverlay, DialogPortal } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

interface IModalProps {
  visible: boolean
  setVisible: React.Dispatch<React.SetStateAction<boolean>>
  children: JSX.Element | JSX.Element[]
  padding?: string
}

export default function Modal({
  visible,
  children,
  setVisible,
  padding,
}: IModalProps) {
  return (
    <Dialog open={visible} onOpenChange={setVisible}>
      <DialogPortal>
        <DialogOverlay className="z-40 bg-deep-space/80 backdrop-blur-sm" />
        <DialogPrimitive.Content
          className={cn(
            "modal glass-panel-heavy fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 border border-[color:var(--modal-border-color)] bg-[color:var(--modal-bg-color)] text-[color:var(--common-text-color)] shadow-lg duration-200 animate-in fade-in-0 zoom-in-95",
            padding ? padding : "px-4 pt-5 pb-4 sm:my-8 sm:p-6"
          )}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {children}
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  )
}

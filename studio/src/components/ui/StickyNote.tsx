import React from "react";

type StickyNoteProps = React.HTMLAttributes<HTMLDivElement> & {
  tone?: "yellow" | "blue" | "rose";
};

const toneClass = {
  yellow: "bg-sticky-1 border-amber-200/60",
  blue: "bg-sticky-2 border-sky-200/60",
  rose: "bg-sticky-3 border-rose-200/60",
};

export function StickyNote({ tone = "yellow", className = "", children, ...props }: StickyNoteProps) {
  return (
    <div
      className={`rounded-md border shadow-sticky p-3 text-sm text-ink ${toneClass[tone]} ${className}`.trim()}
      {...props}
    >
      {children}
    </div>
  );
}

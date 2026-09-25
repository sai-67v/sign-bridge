import React from "react";

export function Kbd({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={`rounded border border-[var(--common-border-light-color)] bg-[var(--common-dark-bg-color)] px-1.5 py-0.5 font-mono text-2xs text-[var(--common-semidark-text-color)] ${className}`.trim()}
    >
      {children}
    </kbd>
  );
}

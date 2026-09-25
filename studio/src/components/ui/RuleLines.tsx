import React from "react";

/**
 * Optional vertical rule lines suggesting paper margins (decorative).
 */
export function RuleLines({ className = "" }: { className?: string }) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 z-0 ${className}`.trim()}
      aria-hidden
    >
      <div className="absolute left-6 top-0 h-full w-px bg-rule/40 sm:left-10" />
      <div className="absolute right-6 top-0 h-full w-px bg-rule/40 sm:right-10" />
    </div>
  );
}

import React from "react";

export function Divider({ className = "" }: { className?: string }) {
  return <hr className={`border-0 border-t border-[var(--common-border-light-color)] ${className}`.trim()} />;
}

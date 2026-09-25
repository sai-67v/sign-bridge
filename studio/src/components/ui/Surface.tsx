import React from "react";

type SurfaceProps = React.HTMLAttributes<HTMLDivElement> & {
  as?: "div" | "section" | "article";
};

/**
 * Neutral raised surface (paper sheet, cards). Uses theme CSS variables where possible.
 */
export function Surface({ as: Comp = "div", className = "", ...props }: SurfaceProps) {
  return (
    <Comp
      className={`rounded-lg border border-[var(--common-border-light-color)] bg-[var(--common-bg-color)] shadow-paper ${className}`.trim()}
      {...props}
    />
  );
}

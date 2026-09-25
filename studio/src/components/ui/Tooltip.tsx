import React, { useId, useState } from "react";

type TooltipProps = {
  label: string;
  children: React.ReactElement<Record<string, unknown>>;
  className?: string;
};

/**
 * Minimal accessible tooltip: wraps a single focusable/hoverable child.
 */
export function Tooltip({ label, children, className = "" }: TooltipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const child = React.Children.only(children);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = child as any;

  return (
    <span className={`relative inline-flex ${className}`.trim()}>
      {React.cloneElement(child, {
        "aria-describedby": open ? id : undefined,
        onFocus: (e: React.FocusEvent<Element>) => {
          c.props.onFocus?.(e);
          setOpen(true);
        },
        onBlur: (e: React.FocusEvent<Element>) => {
          c.props.onBlur?.(e);
          setOpen(false);
        },
        onMouseEnter: (e: React.MouseEvent<Element>) => {
          c.props.onMouseEnter?.(e);
          setOpen(true);
        },
        onMouseLeave: (e: React.MouseEvent<Element>) => {
          c.props.onMouseLeave?.(e);
          setOpen(false);
        },
      })}
      {open ? (
        <span
          id={id}
          role="tooltip"
          className="absolute bottom-full left-1/2 z-50 mb-1 -translate-x-1/2 whitespace-nowrap rounded border border-[var(--common-border-light-color)] bg-[var(--common-dark-bg-color)] px-2 py-1 text-2xs text-[var(--common-semidark-text-color)] shadow-paper"
        >
          {label}
        </span>
      ) : null}
    </span>
  );
}

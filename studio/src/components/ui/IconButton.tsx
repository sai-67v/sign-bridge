import React from "react";

type IconButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

export function IconButton({ className = "", type = "button", ...props }: IconButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-md border border-transparent text-[var(--common-text-color)] transition-colors hover:bg-[var(--common-btn-bg-hover-color)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--common-primary-color)] ${className}`.trim()}
      {...props}
    />
  );
}

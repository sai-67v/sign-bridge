import React from "react";

type PaperButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "outline";
};

export function PaperButton({
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: PaperButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--common-primary-color)] disabled:opacity-50 disabled:pointer-events-none";

  const variants = {
    primary:
      "bg-[var(--common-primary-color)] text-[var(--common-primary-text-color)] hover:bg-[var(--common-primary-hover-color)] px-4 py-2",
    ghost:
      "bg-transparent text-[var(--common-text-color)] hover:bg-[var(--common-btn-bg-hover-color)] px-3 py-2",
    outline:
      "border border-[var(--common-border-color)] bg-[var(--common-bg-color)] text-[var(--common-text-color)] hover:bg-[var(--common-btn-bg-hover-color)] px-4 py-2",
  }[variant];

  return <button type={type} className={`${base} ${variants} ${className}`.trim()} {...props} />;
}

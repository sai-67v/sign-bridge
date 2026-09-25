interface IButtonProp {
  onClick?: () => void;
  submit?: boolean;
  block?: boolean;
  className?: string;
  size?: string;
  secondary?: boolean;
  disabled?: boolean;
  children: JSX.Element | JSX.Element[] | React.ReactNode;
}

function Button({
  className,
  secondary = false,
  children,
  submit = false,
  block = false,
  size = "px-4 py-2",
  ...rest
}: IButtonProp) {

  const color = secondary ? "" : "btn-primary"
  const mergedClass = ["btn", block ? "w-full" : "", className, size, color].filter(Boolean).join(" ")

  return (
    <button
      {...rest}
      type={submit ? "submit" : "button"}
      className={mergedClass}
    >
      {children}
    </button>
  );
}

export default Button;

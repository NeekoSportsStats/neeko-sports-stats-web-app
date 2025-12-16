import * as React from "react";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "secondary" | "ghost";
  size?: "sm" | "default" | "lg";
};

const cx = (...c: Array<string | false | undefined>) => c.filter(Boolean).join(" ");

export function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonProps) {
  const variantCls =
    variant === "secondary"
      ? "bg-white/5 hover:bg-white/10 text-white border border-white/10"
      : variant === "ghost"
      ? "bg-transparent hover:bg-white/10 text-white border border-white/10"
      : "bg-amber-400 hover:bg-amber-300 text-black";

  const sizeCls =
    size === "sm"
      ? "h-9 px-3 text-sm"
      : size === "lg"
      ? "h-11 px-6 text-base"
      : "h-10 px-4 text-sm";

  return (
    <button
      className={cx(
        "inline-flex items-center justify-center rounded-xl font-medium transition-all",
        "focus:outline-none focus:ring-2 focus:ring-amber-300/40",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        variantCls,
        sizeCls,
        className
      )}
      {...props}
    />
  );
}

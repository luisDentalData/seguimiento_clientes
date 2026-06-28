import type { ButtonHTMLAttributes } from "react";
import { cn as cx } from "@/lib/utils";

type Variant = "primary" | "accent" | "ghost" | "danger" | "dangerGhost";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  /** Pill shape with a trailing arrow chip. */
  pill?: boolean;
  loading?: boolean;
}

const base =
  "inline-flex items-center gap-2 font-sans font-semibold text-sm tracking-[0.01em] " +
  "transition ease-standard duration-base active:translate-y-px " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-boss-primary focus-visible:ring-offset-2 " +
  "disabled:opacity-50 disabled:pointer-events-none";

const variants: Record<Variant, string> = {
  primary: "bg-ink text-white hover:bg-[#222a2e]",
  accent: "bg-accent text-white hover:bg-[#cf440a]",
  ghost: "bg-transparent text-fg border border-ink hover:bg-ink hover:text-white",
  danger: "bg-danger text-white hover:bg-[#9a1d14]",
  // Quiet destructive: red text, transparent until hover. Demotes per-row Delete
  // triggers so destructive actions stop shouting on every table row. The solid
  // `danger` fill is reserved for confirmation dialogs.
  dangerGhost:
    "bg-transparent text-danger-fg border border-transparent hover:bg-danger-tint hover:border-danger-fg",
};

export function Button({ variant = "primary", pill = false, loading = false, className, children, ...props }: ButtonProps) {
  const shape = pill ? "rounded-full pl-[22px] pr-[18px] py-2.5 text-[13px]" : "rounded-none px-[22px] py-3";
  return (
    <button
      className={cx(base, shape, variants[variant], className)}
      disabled={props.disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && (
        <span
          aria-hidden
          className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
      {pill && (
        <span className="ml-1 inline-flex h-[22px] w-[22px] items-center justify-center rounded-full bg-white text-ink">
          →
        </span>
      )}
    </button>
  );
}

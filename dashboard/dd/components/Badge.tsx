import type { HTMLAttributes } from "react";
import { cn as cx } from "@/lib/utils";

type Variant = "plain" | "teal" | "purple" | "orange" | "outlined" | "status";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
}

const base =
  "inline-flex items-center gap-1.5 font-sans text-2xs font-semibold tracking-[0.04em] px-2.5 py-[5px] whitespace-nowrap";

const variants: Record<Variant, string> = {
  plain: "bg-grey-050 text-grey-900 rounded-sm",
  teal: "bg-teal-700 text-white rounded-full",
  purple: "bg-boss-primary text-white rounded-full",
  orange: "bg-orange-700 text-white rounded-full",
  outlined: "bg-transparent text-grey-900 border border-grey-900 rounded-full",
  status: "bg-white text-grey-900 border border-grey-300 rounded-full",
};

export function Badge({ variant = "plain", className, children, ...props }: BadgeProps) {
  return (
    <span className={cx(base, variants[variant], className)} {...props}>
      {variant === "status" && <span className="h-1.5 w-1.5 rounded-full bg-success" />}
      {children}
    </span>
  );
}

import type { HTMLAttributes } from "react";
import { cn as cx } from "@/lib/utils";

type Variant = "soft" | "hairline" | "inverse" | "data";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
}

const variants: Record<Variant, string> = {
  soft:     "bg-surface shadow-md p-[18px] gap-2",
  hairline: "bg-surface border border-line p-[18px] gap-2",
  inverse:  "bg-ink text-white p-[18px] gap-2",
  data:     "bg-surface border border-line p-4 gap-1",
};

/**
 * Cards earn presence through whitespace + shadow, not strokes.
 * Compose children with <Eyebrow>, <Heading>, and text-fg-muted body copy.
 */
export function Card({ variant = "soft", className, children, ...props }: CardProps) {
  return (
    <div className={cx("flex flex-col rounded-none", variants[variant], className)} {...props}>
      {children}
    </div>
  );
}

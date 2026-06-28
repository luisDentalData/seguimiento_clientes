import type { HTMLAttributes } from "react";
import { cn as cx } from "@/lib/utils";

export interface HeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  level?: 1 | 2 | 3;
}

const levels: Record<1 | 2 | 3, string> = {
  1: "font-display font-semibold text-[84px] leading-[0.98] tracking-[-0.025em]",
  2: "font-display font-medium text-[46px] leading-[1.02] tracking-[-0.025em]",
  3: "font-sans font-semibold text-[26px] leading-[1.15] tracking-[-0.01em]",
};

export function Heading({ level = 1, className, children, ...props }: HeadingProps) {
  const Tag = (`h${level}`) as "h1" | "h2" | "h3";
  return (
    <Tag
      className={cx("text-fg text-balance [&_em]:italic [&_em]:text-boss-primary", levels[level], className)}
      {...props}
    >
      {children}
    </Tag>
  );
}

export function Eyebrow({ className, children, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={cx("font-sans text-xs font-semibold uppercase tracking-[0.16em] text-fg-muted", className)} {...props}>
      {children}
    </span>
  );
}

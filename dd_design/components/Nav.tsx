import type { HTMLAttributes, ReactNode } from "react";
import { cn as cx } from "@/lib/utils";

export interface NavItemProps {
  as?: React.ElementType;
  active?: boolean;
  className?: string;
  children: ReactNode;
  [k: string]: unknown;
}

export function NavItem({ as, active = false, className, children, ...rest }: NavItemProps) {
  const Comp = as ?? "a";
  return (
    <Comp
      className={cx(
        "inline-flex items-center py-3 text-sm font-medium transition-colors duration-base",
        "focus-visible:outline-none focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-boss-primary focus-visible:ring-offset-2",
        active ? "text-fg border-b-2 border-boss-primary -mb-px" : "text-fg-muted hover:text-fg",
        className,
      )}
      {...rest}
    >
      {children}
    </Comp>
  );
}

export function Nav({ className, children, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <nav
      className={cx("flex items-center gap-6 border-b border-line", className)}
      aria-label={(props["aria-label"] as string | undefined) ?? "Main"}
      {...props}
    >
      {children}
    </nav>
  );
}

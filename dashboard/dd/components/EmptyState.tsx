import type { ReactNode } from "react";
import { cn as cx } from "@/lib/utils";

export interface EmptyStateProps {
  icon?: string;
  title: string;
  message?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, message, action, className }: EmptyStateProps) {
  return (
    <div className={cx("flex flex-col items-center gap-2 py-12 text-center", className)}>
      {icon && (
        <span aria-hidden="true" className="material-symbols-outlined text-fg-subtle text-[48px] leading-none">
          {icon}
        </span>
      )}
      <p className="font-display text-xl text-fg">{title}</p>
      {message && <p className="text-sm text-fg-muted">{message}</p>}
      {action}
    </div>
  );
}

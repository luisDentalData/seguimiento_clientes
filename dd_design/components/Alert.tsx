import type { ReactNode } from "react";
import { cn as cx } from "@/lib/utils";

type Variant = "error" | "info" | "success";

export interface AlertProps {
  variant?: Variant;
  title?: string;
  className?: string;
  children: ReactNode;
}

const iconMap: Record<Variant, string> = {
  error: "error",
  info: "info",
  success: "check_circle",
};

const base = "flex items-start gap-3 rounded-sm border p-4 text-sm";

const variants: Record<Variant, string> = {
  error: "bg-danger-tint border-danger-fg text-danger-fg",
  info: "bg-surface border-line text-fg",
  success: "bg-success-tint border-success text-success",
};

export function Alert({ variant = "error", title, className, children }: AlertProps) {
  const icon = iconMap[variant];
  return (
    <div role="alert" className={cx(base, variants[variant], className)}>
      <span aria-hidden="true" className="material-symbols-outlined text-[20px] leading-none">{icon}</span>
      <div className="flex flex-col gap-1">
        {title && <p className="font-semibold">{title}</p>}
        <div>{children}</div>
      </div>
    </div>
  );
}

import type { ReactNode } from "react";
import { cn as cx } from "@/lib/utils";

export interface FieldProps {
  label?: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

export function Field({ label, htmlFor, error, hint, required, className, children }: FieldProps) {
  return (
    <div className={cx("mb-3.5 flex flex-col gap-1.5", className)}>
      {label && (
        <label htmlFor={htmlFor} className="font-sans text-2xs font-semibold uppercase tracking-[0.16em] text-fg-muted">
          {label}
          {required && <span className="text-danger-fg"> *</span>}
        </label>
      )}
      {children}
      {hint && !error && <span className="text-2xs text-fg-muted">{hint}</span>}
      {error && <span role="alert" className="text-2xs text-danger-fg">{error}</span>}
    </div>
  );
}

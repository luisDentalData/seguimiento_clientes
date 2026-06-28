import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn as cx } from "@/lib/utils";

export interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  label: ReactNode;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, className, ...props },
  ref,
) {
  return (
    <label className={cx("flex items-center gap-2 text-sm text-fg cursor-pointer", className)}>
      <input ref={ref} type="checkbox" className="accent-boss-primary" {...props} />
      {label}
    </label>
  );
});

Checkbox.displayName = "Checkbox";

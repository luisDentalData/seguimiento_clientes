import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn as cx } from "@/lib/utils";
import { Field } from "./Field";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, id, error, hint, required, placeholder, className, children, ...props },
  ref,
) {
  return (
    <Field label={label} htmlFor={id} error={error} hint={hint} required={required}>
      <div className="relative">
        <select
          ref={ref}
          id={id}
          aria-invalid={!!error}
          className={cx(
            "w-full font-sans text-[15px] px-3.5 py-3 rounded-sm bg-surface text-fg",
            "border outline-none transition-colors duration-base appearance-none pr-9",
            error
              ? "border-danger-fg focus:border-danger-fg"
              : "border-fg-subtle focus:border-ink",
            className,
          )}
          {...props}
        >
          {placeholder && <option value="" disabled>{placeholder}</option>}
          {children}
        </select>
        <span className="material-symbols-outlined pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-fg-muted text-[20px]" aria-hidden="true">
          expand_more
        </span>
      </div>
    </Field>
  );
});

Select.displayName = "Select";

import { forwardRef, type InputHTMLAttributes } from "react";
import { cn as cx } from "@/lib/utils";
import { Field } from "./Field";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Eyebrow-style label rendered above the field. */
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, id, error, hint, required, className, ...props },
  ref,
) {
  return (
    <Field label={label} htmlFor={id} error={error} hint={hint} required={required}>
      <input
        ref={ref}
        id={id}
        aria-invalid={!!error}
        className={cx(
          "font-sans text-[15px] px-3.5 py-3 rounded-sm bg-surface text-fg",
          "border outline-none transition-colors duration-base",
          error
            ? "border-danger-fg focus:border-danger-fg"
            : "border-fg-subtle focus:border-ink",
          className,
        )}
        {...props}
      />
    </Field>
  );
});

Input.displayName = "Input";

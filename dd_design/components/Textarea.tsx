import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn as cx } from "@/lib/utils";
import { Field } from "./Field";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, id, error, hint, required, className, ...props },
  ref,
) {
  return (
    <Field label={label} htmlFor={id} error={error} hint={hint} required={required}>
      <textarea
        ref={ref}
        id={id}
        aria-invalid={!!error}
        className={cx(
          "font-sans text-[15px] px-3.5 py-3 rounded-sm bg-surface text-fg",
          "border outline-none transition-colors duration-base min-h-[88px] resize-y",
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

Textarea.displayName = "Textarea";

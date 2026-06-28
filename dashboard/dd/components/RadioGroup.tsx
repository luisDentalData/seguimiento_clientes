import { useId, type ReactNode } from "react";
import { Field } from "./Field";

export interface RadioGroupProps {
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: ReactNode }[];
  label?: string;
  error?: string;
  required?: boolean;
  className?: string;
}

export function RadioGroup({
  name,
  value,
  onChange,
  options,
  label,
  error,
  required,
  className,
}: RadioGroupProps) {
  const labelId = useId();
  return (
    <Field error={error} className={className}>
      {label && (
        <span
          id={labelId}
          className="font-sans text-2xs font-semibold uppercase tracking-[0.16em] text-fg-muted"
        >
          {label}
          {required && <span className="text-danger-fg"> *</span>}
        </span>
      )}
      <div
        role="radiogroup"
        aria-labelledby={label ? labelId : undefined}
        className="flex flex-col gap-2"
      >
        {options.map((opt) => (
          <label
            key={opt.value}
            className="flex items-center gap-2 text-sm text-fg cursor-pointer"
          >
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
              className="accent-boss-primary"
            />
            {opt.label}
          </label>
        ))}
      </div>
    </Field>
  );
}

import { cn as cx } from "@/lib/utils";

export interface StatProps {
  value: string;
  label: string;
  accent?: boolean;
  className?: string;
}

export function Stat({ value, label, accent = false, className }: StatProps) {
  return (
    <div className={cx("flex flex-col", className)}>
      <span
        className={cx(
          "font-display font-medium text-[120px] leading-[0.9] tracking-[-0.04em]",
          accent ? "text-accent" : "text-fg",
        )}
      >
        {value}
      </span>
      <span className="mt-2 font-sans text-[13px] font-medium tracking-[0.02em] leading-tight text-fg-muted">
        {label}
      </span>
    </div>
  );
}

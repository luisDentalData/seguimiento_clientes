import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cn as cx } from "@/lib/utils";

export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  // Wrap in a horizontal-scroll container so wide data tables scroll on small
  // screens instead of clipping columns. min-width forces scroll rather than
  // crushing cells.
  return (
    <div className="w-full overflow-x-auto">
      <table className={cx("w-full min-w-[40rem] border-collapse text-left", className)} {...props} />
    </div>
  );
}

export function THead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={className} {...props} />;
}

export function TBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={className} {...props} />;
}

export function Tr({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={cx("border-b border-line", className)} {...props} />
  );
}

export function Th({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cx(
        "px-4 py-3 font-sans text-2xs font-semibold uppercase tracking-[0.16em] text-fg-muted",
        className,
      )}
      {...props}
    />
  );
}

export function Td({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cx("px-4 py-3 font-sans text-sm text-fg", className)} {...props} />
  );
}

export interface TableMessageProps {
  colSpan: number;
  children: ReactNode;
}

export function TableMessage({ colSpan, children }: TableMessageProps) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10 text-center text-sm text-fg-muted">
        {children}
      </td>
    </tr>
  );
}

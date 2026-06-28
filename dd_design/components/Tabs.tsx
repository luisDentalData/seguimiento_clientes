import { useRef, type ReactNode } from "react";
import { cn as cx } from "@/lib/utils";

export interface TabsProps {
  items: { value: string; label: ReactNode }[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  "aria-label"?: string;
}

/**
 * Controlled, accessible tab list. Selection follows focus (WAI-ARIA APG):
 * Arrow / Home / End move both the selection and DOM focus to the new tab.
 *
 * The consumer renders the matching panel:
 *   <div role="tabpanel" id={`panel-${value}`} aria-labelledby={`tab-${value}`}>
 *     {content for the active tab}
 *   </div>
 */
export function Tabs({ items, value, onChange, className, "aria-label": ariaLabel }: TabsProps) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function select(index: number) {
    const item = items[index];
    if (!item) return;
    onChange(item.value);
    tabRefs.current[index]?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const currentIndex = items.findIndex((item) => item.value === value);
    if (e.key === "ArrowRight") {
      e.preventDefault();
      select((currentIndex + 1) % items.length);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      select((currentIndex - 1 + items.length) % items.length);
    } else if (e.key === "Home") {
      e.preventDefault();
      select(0);
    } else if (e.key === "End") {
      e.preventDefault();
      select(items.length - 1);
    }
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cx("flex items-center gap-6 border-b border-line", className)}
      onKeyDown={handleKeyDown}
    >
      {items.map((item, index) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            ref={(el) => {
              tabRefs.current[index] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${item.value}`}
            aria-selected={active}
            aria-controls={`panel-${item.value}`}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(item.value)}
            className={cx(
              "py-3 text-sm font-medium transition-colors duration-base",
              active
                ? "text-fg border-b-2 border-boss-primary -mb-px"
                : "text-fg-muted hover:text-fg",
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

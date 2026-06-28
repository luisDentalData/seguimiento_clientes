import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { cn as cx } from "@/lib/utils";

export interface SearchableSelectProps {
  value: string | null;
  onChange: (value: string | null) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
}

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Select...",
  className,
  "aria-label": ariaLabel,
}: SearchableSelectProps) {
  const uid = useId();
  const inputId = `${uid}input`;
  const listboxId = `${uid}listbox`;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState<number>(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedLabel = useMemo(
    () => options.find((o) => o.value === value)?.label ?? null,
    [options, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  function openList() {
    setOpen(true);
  }

  function closeList() {
    setOpen(false);
    setQuery("");
    setActiveIndex(-1);
  }

  // Derived: clamp activeIndex to current filtered length without a side-effect setState
  const safeActiveIndex =
    filtered.length === 0 ? -1 : Math.min(activeIndex, filtered.length - 1);

  useEffect(() => {
    if (!open) return;
    function handleMouseDown(e: globalThis.MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        closeList();
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [open]);

  function selectOption(optValue: string) {
    onChange(optValue);
    closeList();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        openList();
        setActiveIndex((prev) =>
          filtered.length === 0 ? -1 : (prev + 1) % filtered.length,
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        openList();
        setActiveIndex((prev) =>
          filtered.length === 0
            ? -1
            : (prev - 1 + filtered.length) % filtered.length,
        );
        break;
      case "Enter":
        e.preventDefault();
        if (open && safeActiveIndex >= 0 && filtered[safeActiveIndex]) {
          selectOption(filtered[safeActiveIndex].value);
        } else {
          openList();
        }
        break;
      case "Escape":
        e.preventDefault();
        closeList();
        break;
      default:
        break;
    }
  }

  function optionId(index: number) {
    return `${uid}opt-${index}`;
  }

  const activeDescendant =
    open && safeActiveIndex >= 0 ? optionId(safeActiveIndex) : undefined;

  const inputDisplayValue = open ? query : (selectedLabel ?? "");

  return (
    <div ref={containerRef} className={cx("relative", className)}>
      <div
        className={cx(
          "flex items-center rounded-sm bg-surface px-2 py-2 text-sm transition-colors duration-base cursor-text",
          "border border-fg-subtle focus-within:border-ink",
        )}
        onClick={() => {
          inputRef.current?.focus();
          openList();
        }}
      >
        <input
          ref={inputRef}
          id={inputId}
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={activeDescendant}
          aria-label={ariaLabel}
          autoComplete="off"
          value={inputDisplayValue}
          placeholder={!value ? placeholder : undefined}
          onChange={(e) => {
            setQuery(e.target.value);
            openList();
          }}
          onFocus={() => openList()}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-transparent outline-none text-sm text-fg placeholder:text-fg-muted"
        />

        {value !== null && (
          <button
            type="button"
            aria-label="Clear selection"
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
              setQuery("");
            }}
            className="ml-1 text-fg-muted hover:text-fg focus:outline-none"
          >
            <span
              className="material-symbols-outlined text-[16px] leading-none"
              aria-hidden="true"
            >
              close
            </span>
          </button>
        )}

        <span
          className="material-symbols-outlined text-[18px] leading-none text-fg-muted select-none pointer-events-none ml-1"
          aria-hidden="true"
        >
          expand_more
        </span>
      </div>

      {open && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Options"
          className="absolute left-0 right-0 top-full mt-1 z-20 max-h-60 overflow-auto rounded-sm border border-line bg-surface shadow-md"
        >
          {filtered.length === 0 ? (
            <li
              role="option"
              aria-selected={false}
              aria-disabled="true"
              className="px-3 py-2 text-sm text-fg-muted select-none"
            >
              No results
            </li>
          ) : (
            filtered.map((opt, index) => {
              const isSelected = opt.value === value;
              const isActive = index === safeActiveIndex;
              return (
                <li
                  key={opt.value}
                  id={optionId(index)}
                  role="option"
                  aria-selected={isActive || isSelected}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectOption(opt.value);
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={cx(
                    "flex items-center gap-2 px-3 py-2 text-sm text-fg cursor-pointer select-none transition-colors duration-fast",
                    isActive && "bg-canvas",
                  )}
                >
                  <span
                    className={cx(
                      "material-symbols-outlined text-[16px] leading-none transition-opacity duration-fast",
                      isSelected ? "opacity-100" : "opacity-0",
                    )}
                    aria-hidden="true"
                  >
                    check
                  </span>
                  {opt.label}
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { cn as cx } from "@/lib/utils";
import { Field } from "./Field";

export interface MultiSelectProps {
  options: { value: string; label: string }[];
  value: string[];
  onChange: (value: string[]) => void;
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  placeholder?: string;
  id?: string;
  className?: string;
}

export function MultiSelect({
  options,
  value,
  onChange,
  label,
  error,
  hint,
  required,
  placeholder,
  id,
  className,
}: MultiSelectProps) {
  const uid = useId();
  const inputId = id ?? `${uid}input`;
  const listboxId = `${uid}listbox`;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState<number>(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    setActiveIndex((prev) => (filtered.length === 0 ? -1 : Math.min(prev, filtered.length - 1)));
  }, [filtered.length]);

  useEffect(() => {
    if (!open) return;
    function handleMouseDown(e: globalThis.MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
        setActiveIndex(-1);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [open]);

  function openList() {
    setOpen(true);
    if (activeIndex === -1 && filtered.length > 0) setActiveIndex(0);
  }

  function closeList() {
    setOpen(false);
    setQuery("");
    setActiveIndex(-1);
  }

  function toggleOption(optValue: string) {
    if (value.includes(optValue)) {
      onChange(value.filter((v) => v !== optValue));
    } else {
      onChange([...value, optValue]);
    }
  }

  function removeValue(optValue: string) {
    onChange(value.filter((v) => v !== optValue));
  }

  function handleControlClick(e: MouseEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest("button")) return;
    inputRef.current?.focus();
    openList();
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
        if (open && activeIndex >= 0 && filtered[activeIndex]) {
          toggleOption(filtered[activeIndex].value);
        } else {
          openList();
        }
        break;
      case "Escape":
        e.preventDefault();
        closeList();
        break;
      case "Backspace":
        if (query === "" && value.length > 0) {
          onChange(value.slice(0, -1));
        }
        break;
      default:
        break;
    }
  }

  function optionId(index: number) {
    return `${uid}opt-${index}`;
  }

  const activeDescendant =
    open && activeIndex >= 0 ? optionId(activeIndex) : undefined;

  const selectedOptions = value
    .map((v) => options.find((o) => o.value === v))
    .filter((o): o is { value: string; label: string } => o !== undefined);

  return (
    <Field
      label={label}
      htmlFor={inputId}
      error={error}
      hint={hint}
      required={required}
      className={className}
    >
      <div ref={containerRef} className="relative">
        <div
          onClick={handleControlClick}
          className={cx(
            "flex flex-wrap items-center gap-1.5 rounded-sm bg-surface px-2 py-2 text-sm transition-colors duration-base cursor-text",
            "border",
            error
              ? "border-danger-fg focus-within:border-danger-fg"
              : "border-fg-subtle focus-within:border-ink",
          )}
        >
          {selectedOptions.map((opt) => (
            <span
              key={opt.value}
              className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2 py-0.5 text-2xs text-fg"
            >
              {opt.label}
              <button
                type="button"
                aria-label={`Remove ${opt.label}`}
                onClick={(e) => {
                  e.stopPropagation();
                  removeValue(opt.value);
                }}
                className="leading-none text-fg-muted hover:text-fg focus:outline-none"
              >
                <span className="material-symbols-outlined text-[14px] leading-none" aria-hidden="true">
                  close
                </span>
              </button>
            </span>
          ))}

          <input
            ref={inputRef}
            id={inputId}
            role="combobox"
            aria-expanded={open}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={activeDescendant}
            aria-invalid={!!error}
            aria-required={required}
            autoComplete="off"
            value={query}
            placeholder={selectedOptions.length === 0 ? placeholder : undefined}
            onChange={(e) => {
              setQuery(e.target.value);
              openList();
            }}
            onFocus={() => openList()}
            onKeyDown={handleKeyDown}
            className="flex-1 min-w-[80px] bg-transparent outline-none text-sm text-fg placeholder:text-fg-muted"
          />

          <span
            className="material-symbols-outlined text-[18px] leading-none text-fg-muted select-none pointer-events-none"
            aria-hidden="true"
          >
            expand_more
          </span>
        </div>

        {open && (
          <ul
            id={listboxId}
            role="listbox"
            aria-multiselectable="true"
            aria-label={label ?? "Options"}
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
                const isSelected = value.includes(opt.value);
                const isActive = index === activeIndex;
                return (
                  <li
                    key={opt.value}
                    id={optionId(index)}
                    role="option"
                    aria-selected={isSelected}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      toggleOption(opt.value);
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
    </Field>
  );
}

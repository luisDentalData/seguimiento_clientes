import {
  useEffect,
  useRef,
  useId,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cn as cx } from "@/lib/utils";
import { Button } from "./Button";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns all focusable elements inside a container in DOM order. */
function getFocusable(container: HTMLElement): HTMLElement[] {
  const selector = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    '[tabindex]:not([tabindex="-1"])',
    "details > summary",
  ].join(",");
  return Array.from(container.querySelectorAll<HTMLElement>(selector));
}

// ---------------------------------------------------------------------------
// ModalProps
// ---------------------------------------------------------------------------

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

export function Modal({ open, onClose, title, children, className }: ModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  // Store the element that had focus before the modal opened.
  const previousFocusRef = useRef<Element | null>(null);

  // Focus management: capture previous focus, move focus into panel on open,
  // restore previous focus on close.
  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement;

    // Defer one tick so the portal is painted before we try to focus.
    const raf = requestAnimationFrame(() => {
      panelRef.current?.focus();
    });

    return () => {
      cancelAnimationFrame(raf);
      // Restore focus to the element that was focused before the modal opened.
      if (
        previousFocusRef.current &&
        typeof (previousFocusRef.current as HTMLElement).focus === "function"
      ) {
        (previousFocusRef.current as HTMLElement).focus();
      }
    };
  }, [open]);

  // Escape key closes the modal.
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Scroll lock.
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  // Tab focus-trap: cycle within focusable children of the panel.
  function handleKeyDownPanel(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Tab" || !panelRef.current) return;

    const focusable = getFocusable(panelRef.current);
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey) {
      // Shift+Tab: if focus is on the first item (or the panel itself), wrap to last.
      if (document.activeElement === first || document.activeElement === panelRef.current) {
        e.preventDefault();
        last.focus();
      }
    } else {
      // Tab: if focus is on the last item, wrap to first.
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  if (!open) return null;

  const modal = (
    // Backdrop — no aria-hidden so the inner role="dialog" is accessible
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/55"
      onClick={onClose}
    >
      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={cx(
          "w-full max-w-md rounded-lg bg-surface text-fg shadow-lg p-6 flex flex-col gap-4",
          "focus:outline-none",
          className,
        )}
        // Stop backdrop click from bubbling through the panel.
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDownPanel}
      >
        {title && (
          <h2 id={titleId} className="font-display text-xl text-fg">
            {title}
          </h2>
        )}
        {children}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

// ---------------------------------------------------------------------------
// ConfirmDialogProps
// ---------------------------------------------------------------------------

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
}

// ---------------------------------------------------------------------------
// ConfirmDialog
// ---------------------------------------------------------------------------

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  cancelLabel,
  danger = false,
  loading = false,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      {message && <p className="text-sm text-fg-muted">{message}</p>}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          {cancelLabel ?? "Cancelar"}
        </Button>
        <Button
          variant={danger ? "danger" : "primary"}
          loading={loading}
          onClick={onConfirm}
        >
          {confirmLabel ?? "Confirmar"}
        </Button>
      </div>
    </Modal>
  );
}

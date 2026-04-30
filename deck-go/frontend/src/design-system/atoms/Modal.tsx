import { useEffect, useRef, type ReactNode } from "react";
import { useEscapeClose } from "../hooks/use-escape-close";
import { useFocusTrap } from "../hooks/use-focus-trap";
import "./modal.css";

export type ModalSize = "sm" | "md" | "lg";

export interface ModalProps {
  /** Whether the modal is shown. */
  open: boolean;
  /** Called when the modal requests to close (Escape or scrim click). */
  onClose: () => void;
  /** Width preset. `sm` 320, `md` 480, `lg` 640. Default: `sm` (matches existing approval/confirm dialogs). */
  size?: ModalSize;
  /** When true, scrim click is ignored (for destructive confirmations that require explicit decision). */
  dismissOnScrimClick?: boolean;
  /** Disable focus trap. Default: false (trap on). */
  noFocusTrap?: boolean;
  /** Aria-label for the dialog. Required when no labelledBy. */
  "aria-label"?: string;
  /** Aria-labelledby — id of header element. */
  "aria-labelledby"?: string;
  /** Aria-describedby — id of body description element. */
  "aria-describedby"?: string;
  children: ReactNode;
  className?: string;
}

/**
 * Container atom: centered scrim + dialog with focus trap and Escape close.
 * Use for approvals, destructive confirms, multi-step wizards.
 *
 * Caller owns header/footer structure; design-system supplies scrim + frame +
 * focus management + Escape only.
 */
export function Modal({
  open,
  onClose,
  size = "sm",
  dismissOnScrimClick = true,
  noFocusTrap = false,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
  children,
  className,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEscapeClose(open, onClose);
  useFocusTrap(dialogRef, open && !noFocusTrap);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) {
    return null;
  }

  const classes = ["ds-modal", `ds-modal--${size}`];
  if (className) {
    classes.push(className);
  }

  function onScrimClick(): void {
    if (dismissOnScrimClick) {
      onClose();
    }
  }

  return (
    <div className="ds-modal-scrim" onClick={onScrimClick} role="presentation">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabelledBy ? undefined : ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        className={classes.join(" ")}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

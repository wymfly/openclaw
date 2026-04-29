import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { useEscapeClose } from "../hooks/use-escape-close";
import { useFocusTrap } from "../hooks/use-focus-trap";
import "./drawer.css";

export type DrawerSide = "right" | "left";

export interface DrawerProps {
  /** Whether the drawer is shown. */
  open: boolean;
  /** Called when the drawer requests to close (Escape, scrim click, or close button via caller). */
  onClose: () => void;
  /** Anchored side. Default: `right`. */
  side?: DrawerSide;
  /** Drawer width in px (default 360). The right-panel chat surface uses 320–800 with localStorage persistence in the consumer. */
  width?: number;
  /** Show a translucent scrim behind the drawer that closes on click. Default: false (chat right panel does not use a scrim). */
  scrim?: boolean;
  /** Trap focus inside drawer while open. Default: true. */
  focusTrap?: boolean;
  /** Aria-label for the dialog (TS-required when no labelledBy). */
  "aria-label"?: string;
  /** Reference to header element id used as dialog accessible name. */
  "aria-labelledby"?: string;
  children: ReactNode;
  className?: string;
}

/**
 * Container atom: side-anchored panel for secondary surfaces (right artifact panel,
 * canvas drawer, etc.). Composes `useFocusTrap` + `useEscapeClose`.
 *
 * For modal-style "centered card" use `Modal` instead.
 */
export function Drawer({
  open,
  onClose,
  side = "right",
  width = 360,
  scrim = false,
  focusTrap = true,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  children,
  className,
}: DrawerProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEscapeClose(open, onClose);
  useFocusTrap(dialogRef, open && focusTrap);

  // Lock background scroll while a scrim is up (matches Modal behavior).
  useEffect(() => {
    if (!open || !scrim) {
      return undefined;
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open, scrim]);

  if (!open) {
    return null;
  }

  const classes = ["ds-drawer", `ds-drawer--${side}`];
  if (className) {
    classes.push(className);
  }
  const style: CSSProperties = { width: `${width}px` };

  const dialog = (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal={scrim ? "true" : undefined}
      aria-label={ariaLabelledBy ? undefined : ariaLabel}
      aria-labelledby={ariaLabelledBy}
      className={classes.join(" ")}
      style={style}
    >
      {children}
    </div>
  );

  if (!scrim) {
    return dialog;
  }
  return (
    <div className="ds-drawer-scrim" onClick={onClose} role="presentation">
      <div onClick={(e) => e.stopPropagation()}>{dialog}</div>
    </div>
  );
}

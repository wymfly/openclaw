import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { useClickOutside } from "../hooks/use-click-outside";
import { useEscapeClose } from "../hooks/use-escape-close";
import "./popover.css";

export type PopoverPlacement = "top" | "bottom" | "auto";

export interface PopoverProps {
  /** Whether the popover is shown. Caller controls. */
  open: boolean;
  /** Called when Escape pressed or click-outside (anchor + content excluded). */
  onClose: () => void;
  /** Element the popover positions itself relative to. */
  anchorRef: RefObject<HTMLElement | null>;
  /** Preferred placement; `auto` flips to top if no room below. Default: `bottom`. */
  placement?: PopoverPlacement;
  /** Visible offset between anchor and popover. Default: 6px. */
  offset?: number;
  /** Required a11y label or labelledby — popover is a dialog-ish region. */
  "aria-label"?: string;
  "aria-labelledby"?: string;
  children: ReactNode;
  className?: string;
}

/**
 * Overlay atom: anchored floating panel. Composes useEscapeClose + useClickOutside.
 * Pair with `usePopover()` for open-state management, or control directly.
 */
export function Popover({
  open,
  onClose,
  anchorRef,
  placement = "bottom",
  offset = 6,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  children,
  className,
}: PopoverProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(
    null,
  );

  useEscapeClose(open, onClose);
  useClickOutside(contentRef, open, (event) => {
    const target = event.target as Node | null;
    if (!target) {
      return;
    }
    if (anchorRef.current?.contains(target)) {
      return;
    }
    onClose();
  });

  useEffect(() => {
    if (!open) {
      setPosition(null);
      return undefined;
    }
    function compute(): void {
      const anchor = anchorRef.current;
      const content = contentRef.current;
      if (!anchor) {
        return;
      }
      const aRect = anchor.getBoundingClientRect();
      const cHeight = content?.offsetHeight ?? 0;
      const cWidth = content?.offsetWidth ?? aRect.width;
      let placeAbove = placement === "top";
      if (placement === "auto") {
        const spaceBelow = window.innerHeight - aRect.bottom;
        placeAbove = spaceBelow < cHeight + offset;
      }
      const top = placeAbove ? aRect.top - cHeight - offset : aRect.bottom + offset;
      const minWidth = aRect.width;
      let left = aRect.left;
      if (left + cWidth > window.innerWidth) {
        left = Math.max(8, window.innerWidth - cWidth - 8);
      }
      setPosition({ top: top + window.scrollY, left: left + window.scrollX, width: minWidth });
    }
    compute();
    const onResize = (): void => compute();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [open, anchorRef, placement, offset]);

  if (!open) {
    return null;
  }

  const classes = ["ds-popover"];
  if (className) {
    classes.push(className);
  }
  return (
    <div
      ref={contentRef}
      role="dialog"
      aria-label={ariaLabelledBy ? undefined : ariaLabel}
      aria-labelledby={ariaLabelledBy}
      className={classes.join(" ")}
      style={
        position
          ? {
              top: `${position.top}px`,
              left: `${position.left}px`,
              minWidth: `${position.width}px`,
            }
          : { visibility: "hidden" }
      }
    >
      {children}
    </div>
  );
}

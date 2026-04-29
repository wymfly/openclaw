import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import "./tooltip.css";

export interface TooltipProps {
  /** Visible content. Caller supplies copy. */
  content: ReactNode;
  /** The element the tooltip describes. Receives `aria-describedby` + hover/focus listeners. */
  children: ReactElement;
  /** Hover delay before showing in ms. Default: 200. */
  openDelay?: number;
  /** Placement; `top` (default) or `bottom`. */
  placement?: "top" | "bottom";
  /** Visible class for the floating bubble. */
  className?: string;
}

/**
 * Overlay atom: hover/focus tooltip. Caller wraps a single focusable child;
 * we clone it to attach listeners + `aria-describedby`. No portal; positioned
 * via inline style relative to the anchor.
 */
export function Tooltip({
  content,
  children,
  openDelay = 200,
  placement = "top",
  className,
}: TooltipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const anchorRef = useRef<HTMLElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function show(): void {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => setOpen(true), openDelay);
  }
  function hide(): void {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setOpen(false);
  }

  useEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    const anchor = anchorRef.current;
    const tooltip = tooltipRef.current;
    if (!anchor || !tooltip) {
      return;
    }
    const aRect = anchor.getBoundingClientRect();
    const tWidth = tooltip.offsetWidth;
    const tHeight = tooltip.offsetHeight;
    const offset = 6;
    const top = placement === "top" ? aRect.top - tHeight - offset : aRect.bottom + offset;
    const left = aRect.left + aRect.width / 2 - tWidth / 2;
    setPosition({ top: top + window.scrollY, left: left + window.scrollX });
  }, [open, placement]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  if (!isValidElement(children)) {
    return children as ReactNode as ReactElement;
  }

  type AnchorProps = {
    onMouseEnter?: (event: unknown) => void;
    onMouseLeave?: (event: unknown) => void;
    onFocus?: (event: unknown) => void;
    onBlur?: (event: unknown) => void;
    "aria-describedby"?: string;
    ref?: unknown;
  };
  const original = children.props as AnchorProps;
  const cloned = cloneElement(children, {
    ...original,
    onMouseEnter: (event: unknown) => {
      original.onMouseEnter?.(event);
      show();
    },
    onMouseLeave: (event: unknown) => {
      original.onMouseLeave?.(event);
      hide();
    },
    onFocus: (event: unknown) => {
      original.onFocus?.(event);
      show();
    },
    onBlur: (event: unknown) => {
      original.onBlur?.(event);
      hide();
    },
    "aria-describedby": id,
    ref: (node: HTMLElement | null) => {
      anchorRef.current = node;
    },
  } as AnchorProps);

  const classes = ["ds-tooltip", `ds-tooltip--${placement}`];
  if (className) {
    classes.push(className);
  }

  return (
    <>
      {cloned}
      {open ? (
        <div
          ref={tooltipRef}
          id={id}
          role="tooltip"
          className={classes.join(" ")}
          style={
            position
              ? { top: `${position.top}px`, left: `${position.left}px` }
              : { visibility: "hidden" }
          }
        >
          {content}
        </div>
      ) : null}
    </>
  );
}

import { useEffect, type HTMLAttributes, type ReactNode } from "react";
import "./toast.css";

export type ToastVariant = "info" | "success" | "warn" | "error";

export interface ToastProps extends HTMLAttributes<HTMLDivElement> {
  variant?: ToastVariant;
  /** When provided, auto-dismisses after this many ms. */
  duration?: number;
  /** Called when duration elapses or user dismisses. */
  onDismiss?: () => void;
  children: ReactNode;
}

/**
 * Overlay atom: single toast notification. Composers render multiple Toasts
 * in a region with `aria-live`. `error` variant defaults to `role="alert"`,
 * others to `role="status"`.
 */
export function Toast({
  variant = "info",
  duration,
  onDismiss,
  role,
  className,
  children,
  ...rest
}: ToastProps) {
  useEffect(() => {
    if (duration === undefined || onDismiss === undefined) {
      return undefined;
    }
    const id = setTimeout(onDismiss, duration);
    return () => clearTimeout(id);
  }, [duration, onDismiss]);

  const classes = ["ds-toast", `ds-toast--${variant}`];
  if (className) {
    classes.push(className);
  }
  return (
    <div
      role={role ?? (variant === "error" ? "alert" : "status")}
      aria-live={variant === "error" ? "assertive" : "polite"}
      className={classes.join(" ")}
      {...rest}
    >
      {children}
    </div>
  );
}

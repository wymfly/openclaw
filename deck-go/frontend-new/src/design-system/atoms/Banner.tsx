import type { HTMLAttributes, ReactNode } from "react";
import "./banner.css";

export type BannerVariant = "info" | "success" | "warn" | "error";
export type BannerLive = "polite" | "assertive";

export interface BannerProps extends HTMLAttributes<HTMLDivElement> {
  variant?: BannerVariant;
  /** ARIA live politeness; default: polite. SSE reconnect uses polite, disconnect uses assertive. */
  live?: BannerLive;
  children: ReactNode;
}

/**
 * Status atom: inline banner with `aria-live` for runtime announcements.
 * Default role: `status` (polite); `error` variant defaults to `alert`.
 * Caller supplies all text via `children` (no hardcoded copy).
 */
export function Banner({
  variant = "info",
  live = "polite",
  role,
  className,
  children,
  ...rest
}: BannerProps) {
  const classes = ["ds-banner", `ds-banner--${variant}`];
  if (className) {
    classes.push(className);
  }
  return (
    <div
      role={role ?? (variant === "error" ? "alert" : "status")}
      aria-live={live}
      className={classes.join(" ")}
      {...rest}
    >
      {children}
    </div>
  );
}

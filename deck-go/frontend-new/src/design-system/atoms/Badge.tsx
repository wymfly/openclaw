import type { HTMLAttributes, ReactNode } from "react";
import "./badge.css";

export type BadgeVariant = "ok" | "warn" | "err" | "running" | "neutral";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  children: ReactNode;
}

/**
 * Status atom: pill-shaped status indicator. Caller supplies `children`
 * (no hardcoded text). Variant maps to semantic token (success/warn/error/accent).
 */
export function Badge({ variant = "neutral", className, children, ...rest }: BadgeProps) {
  const classes = ["ds-badge", `ds-badge--${variant}`];
  if (className) {
    classes.push(className);
  }
  return (
    <span className={classes.join(" ")} {...rest}>
      {children}
    </span>
  );
}

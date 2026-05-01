import type { HTMLAttributes, ReactNode } from "react";
import "./card.css";

export type CardSurface = "elev" | "flat" | "subtle";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Surface elevation. `elev` lifts onto bg-elev; `flat` uses bg-2; `subtle` uses bg-1. Default: `elev`. */
  surface?: CardSurface;
  /** Remove default padding when set. Useful when the body owns its own layout. */
  padded?: boolean;
  children: ReactNode;
}

/**
 * Container atom: neutral panel with rounded border. Caller owns content layout.
 * For collapsible header+body content prefer `Block`.
 */
export function Card({ surface = "elev", padded = true, className, children, ...rest }: CardProps) {
  const classes = ["ds-card", `ds-card--${surface}`];
  if (padded) {
    classes.push("ds-card--padded");
  }
  if (className) {
    classes.push(className);
  }
  return (
    <div className={classes.join(" ")} {...rest}>
      {children}
    </div>
  );
}

import type { HTMLAttributes, ReactNode } from "react";
import "./chip.css";

export interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  active?: boolean;
  children: ReactNode;
}

/**
 * Status atom: small pill chip; `active` toggles accent styling.
 * Used for cache-hit / cost / tool-name chips in chat metadata bar.
 */
export function Chip({ active, className, children, ...rest }: ChipProps) {
  const classes = ["ds-chip"];
  if (active) {
    classes.push("ds-chip--active");
  }
  if (className) {
    classes.push(className);
  }
  return (
    <span className={classes.join(" ")} {...rest}>
      {children}
    </span>
  );
}

import type { HTMLAttributes } from "react";
import "./waiting-dots.css";

export interface WaitingDotsProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  /** Required accessible name for the in-progress state. */
  "aria-label": string;
}

/**
 * Streaming atom: three pulsing dots, used as a "thinking" indicator before
 * the first delta arrives. `role="status"` + required aria-label.
 * Respects `prefers-reduced-motion`.
 */
export function WaitingDots({ className, ...rest }: WaitingDotsProps) {
  const classes = ["ds-waiting-dots"];
  if (className) {
    classes.push(className);
  }
  return (
    <span role="status" className={classes.join(" ")} {...rest}>
      <span aria-hidden className="ds-waiting-dots__dot" />
      <span aria-hidden className="ds-waiting-dots__dot" />
      <span aria-hidden className="ds-waiting-dots__dot" />
    </span>
  );
}

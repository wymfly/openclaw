import type { HTMLAttributes } from "react";
import "./streaming-cursor.css";

export type StreamingCursorProps = Omit<HTMLAttributes<HTMLSpanElement>, "children">;

/**
 * Streaming atom: blinking text cursor used at the tail of an in-progress
 * assistant message. `aria-hidden` since screen readers should not announce it.
 * Respects `prefers-reduced-motion`.
 */
export function StreamingCursor({ className, ...rest }: StreamingCursorProps) {
  const classes = ["ds-streaming-cursor"];
  if (className) {
    classes.push(className);
  }
  return <span aria-hidden className={classes.join(" ")} {...rest} />;
}

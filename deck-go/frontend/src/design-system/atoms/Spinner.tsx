import type { HTMLAttributes } from "react";
import "./spinner.css";

export type SpinnerSize = "sm" | "md";

export interface SpinnerProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  size?: SpinnerSize;
  /** Required accessible name (TS-enforced) for the loading status. */
  "aria-label": string;
}

/**
 * Status atom: rotating loader. `role="status"` + required aria-label so screen
 * readers announce the loading state. Respects `prefers-reduced-motion`.
 */
export function Spinner({ size = "md", className, ...rest }: SpinnerProps) {
  const classes = ["ds-spinner"];
  if (size === "sm") {
    classes.push("ds-spinner--sm");
  }
  if (className) {
    classes.push(className);
  }
  return <span role="status" className={classes.join(" ")} {...rest} />;
}

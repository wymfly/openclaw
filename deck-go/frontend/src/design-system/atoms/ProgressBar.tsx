import type { HTMLAttributes } from "react";
import "./progress-bar.css";

export interface ProgressBarProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /** Progress value in [0, 1]; if undefined, the bar renders indeterminate. */
  value?: number;
  /** Required accessible name for the progress role. */
  "aria-label": string;
}

/**
 * Streaming atom: horizontal progress bar. `role="progressbar"` with
 * `aria-valuemin/max/now`. Indeterminate mode (no `value`) shows a sweeping
 * fill animation; respects `prefers-reduced-motion`.
 */
export function ProgressBar({ value, className, ...rest }: ProgressBarProps) {
  const clamped = value !== undefined ? Math.max(0, Math.min(1, value)) : undefined;
  const classes = ["ds-progress-bar"];
  if (clamped === undefined) {
    classes.push("ds-progress-bar--indeterminate");
  }
  if (className) {
    classes.push(className);
  }
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={1}
      aria-valuenow={clamped}
      className={classes.join(" ")}
      {...rest}
    >
      <div
        className="ds-progress-bar__fill"
        style={clamped !== undefined ? { width: `${clamped * 100}%` } : undefined}
      />
    </div>
  );
}

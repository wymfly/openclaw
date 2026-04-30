import type { ButtonHTMLAttributes, ReactNode } from "react";
import "./tab.css";

export interface TabProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Whether this tab is the active one. */
  active?: boolean;
  /** Visually muted (e.g. agent-tab `muted` variant in bundle). */
  muted?: boolean;
  children: ReactNode;
}

/**
 * Navigation atom: single tab pill (used in agent-tab strips, right-panel
 * artifact-type tabs, etc.). For a complete tab-strip with keyboard
 * navigation, see `SegmentedControl`.
 *
 * Caller is responsible for wrapping multiple `Tab`s with `role="tablist"` and
 * managing `aria-controls`/`aria-selected`. This atom forwards `aria-*` props.
 */
export function Tab({ active = false, muted = false, className, children, ...rest }: TabProps) {
  const classes = ["ds-tab"];
  if (active) {
    classes.push("ds-tab--active");
  }
  if (muted) {
    classes.push("ds-tab--muted");
  }
  if (className) {
    classes.push(className);
  }
  return (
    <button
      type="button"
      role={rest.role ?? "tab"}
      aria-selected={rest["aria-selected"] ?? active}
      tabIndex={active ? 0 : -1}
      className={classes.join(" ")}
      {...rest}
    >
      {children}
    </button>
  );
}

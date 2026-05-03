import type { HTMLAttributes, ReactNode } from "react";
import "./page-shell.css";

export interface PageShellProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "className" | "style"
> {
  /**
   * Optional max content width override. Defaults to `1080`. Set to `"none"` to
   * remove the centered constraint (full-bleed pages, e.g. canvas surfaces).
   */
  maxWidth?: number | "none";
  /** Children render inside the shell. */
  children: ReactNode;
}

/**
 * Pattern: PageShell — top-level view container with centered max-width,
 * consistent padding, and a brief enter animation. Wraps every panel and
 * the list/detail views inside multi-view panels.
 *
 * Owns the column rhythm so panels do not duplicate `max-width / margin / padding`
 * declarations.
 */
export function PageShell({ maxWidth = 1080, children, ...rest }: PageShellProps) {
  const widthVar = maxWidth === "none" ? "100%" : `${maxWidth}px`;
  return (
    <div
      className="ds-page-shell"
      style={{ ["--ds-page-shell-max" as string]: widthVar }}
      {...rest}
    >
      {children}
    </div>
  );
}

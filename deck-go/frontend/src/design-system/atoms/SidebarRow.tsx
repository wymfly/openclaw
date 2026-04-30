import type { ButtonHTMLAttributes, ReactNode } from "react";
import "./sidebar-row.css";

export interface SidebarRowProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "title"> {
  /** Whether this row is currently selected. */
  active?: boolean;
  /** Whether this row's session is currently streaming (accent title). */
  streaming?: boolean;
  /** Primary line. Caller may render an editable input here for inline rename. */
  title: ReactNode;
  /** Optional secondary preview line (one-line ellipsized). */
  preview?: ReactNode;
  /** Optional meta line (timestamp, message count). */
  meta?: ReactNode;
  /** Optional trailing action (e.g. delete button). */
  trailing?: ReactNode;
}

/**
 * Navigation atom: sidebar entry row (chat sessions, agents, channels). Active
 * + streaming variants. Caller owns click handler + trailing action.
 */
export function SidebarRow({
  active = false,
  streaming = false,
  title,
  preview,
  meta,
  trailing,
  className,
  ...rest
}: SidebarRowProps) {
  const classes = ["ds-sidebar-row"];
  if (active) {
    classes.push("ds-sidebar-row--active");
  }
  if (streaming) {
    classes.push("ds-sidebar-row--streaming");
  }
  if (className) {
    classes.push(className);
  }
  return (
    <button
      type="button"
      aria-current={active ? "true" : undefined}
      className={classes.join(" ")}
      {...rest}
    >
      <div className="ds-sidebar-row__title-line">
        <span className="ds-sidebar-row__title">{title}</span>
        {trailing !== undefined ? (
          <span className="ds-sidebar-row__trailing">{trailing}</span>
        ) : null}
      </div>
      {preview !== undefined ? <div className="ds-sidebar-row__preview">{preview}</div> : null}
      {meta !== undefined ? <div className="ds-sidebar-row__meta">{meta}</div> : null}
    </button>
  );
}

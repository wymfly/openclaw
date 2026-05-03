import type { ReactNode } from "react";
import "./empty-state.css";

export type EmptyStateTone = "neutral" | "search" | "error";

export interface EmptyStateProps {
  /** Decorative icon rendered above the title. Typically a 24-28px icon from
   * `@/design-system/icons`. */
  icon?: ReactNode;
  /** Primary heading text. */
  title: string;
  /** Optional supporting copy. */
  description?: string;
  /** Optional action slot — typically a primary button. */
  action?: ReactNode;
  /** Tone shifts the visual emphasis and ARIA semantics. */
  tone?: EmptyStateTone;
}

const ROLE_BY_TONE: Record<EmptyStateTone, "status" | "alert"> = {
  neutral: "status",
  search: "status",
  error: "alert",
};

/**
 * Pattern: EmptyState — a centered no-data placeholder with icon + title +
 * description + optional CTA. Used for empty lists, search-with-no-matches,
 * load failures, and detail-without-selection states.
 *
 * Tone variants:
 *   - `neutral` (default): plain placeholder, role=status
 *   - `search`: tinted to suggest "try different filters", role=status
 *   - `error`: error-colored frame, role=alert
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  tone = "neutral",
}: EmptyStateProps) {
  return (
    <div className={`ds-empty-state ds-empty-state--${tone}`} role={ROLE_BY_TONE[tone]}>
      {icon ? <div className="ds-empty-state__icon">{icon}</div> : null}
      <h3 className="ds-empty-state__title">{title}</h3>
      {description ? <p className="ds-empty-state__description">{description}</p> : null}
      {action ? <div className="ds-empty-state__action">{action}</div> : null}
    </div>
  );
}

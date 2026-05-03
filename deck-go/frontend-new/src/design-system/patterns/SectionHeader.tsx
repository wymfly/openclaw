import type { ReactNode } from "react";
import "./section-header.css";

export interface SectionHeaderProps {
  /** Section title rendered as `<h2>` for document outline correctness. */
  title: string;
  /** Optional supporting description rendered below the title. */
  description?: string;
  /** Optional inline hint rendered to the right of the title (mono font, dim color). */
  hint?: ReactNode;
  /** Optional action slot rendered right-aligned in the header row (typically a button). */
  actions?: ReactNode;
  /** Optional anchor id for skip-link / hash routing. */
  id?: string;
}

/**
 * Pattern: SectionHeader — uniform section heading with title + hint + actions.
 * Used inside detail panels, modal bodies, and form sections.
 *
 * Always renders the title as `<h2>` regardless of nesting level. Document
 * outlining is the consumer's responsibility (use multiple sections inside a
 * single panel sparingly).
 */
export function SectionHeader({ title, description, hint, actions, id }: SectionHeaderProps) {
  return (
    <header className="ds-section-header" id={id}>
      <div className="ds-section-header__main">
        <div className="ds-section-header__row">
          <h2 className="ds-section-header__title">{title}</h2>
          {hint ? <span className="ds-section-header__hint">{hint}</span> : null}
        </div>
        {description ? <p className="ds-section-header__description">{description}</p> : null}
      </div>
      {actions ? <div className="ds-section-header__actions">{actions}</div> : null}
    </header>
  );
}

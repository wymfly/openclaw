import type { ReactNode } from "react";
import "./top-bar.css";

export interface TopBarProps {
  /** Brand label or element rendered on the left. Plain string is wrapped in a
   * standard brand chrome; pass a node for full control. */
  brand: ReactNode;
  /** Slot for global actions (right-aligned). */
  actions?: ReactNode;
  /** Optional callback for the ⌘K command palette button. When omitted, the
   * button is not rendered. */
  onCommandPaletteOpen?: () => void;
  /** Optional accessible label for the bar. */
  "aria-label"?: string;
}

/**
 * Pattern: TopBar — global chrome for the deck shell. Houses the brand on the
 * left, an optional ⌘K command palette entry, and a right-aligned action slot.
 *
 * Stays stateless. Callers wire `onCommandPaletteOpen` to their command surface.
 * Keyboard shortcut handling is the caller's responsibility (the bar only
 * announces the shortcut via `aria-keyshortcuts`).
 */
export function TopBar({
  brand,
  actions,
  onCommandPaletteOpen,
  "aria-label": ariaLabel,
}: TopBarProps) {
  return (
    <header className="ds-top-bar" aria-label={ariaLabel ?? "Application bar"}>
      <div className="ds-top-bar__brand">
        {typeof brand === "string" ? <strong>{brand}</strong> : brand}
      </div>
      <div className="ds-top-bar__right">
        {onCommandPaletteOpen ? (
          <button
            type="button"
            className="ds-top-bar__command"
            aria-label="Open command palette"
            aria-keyshortcuts="Meta+K Control+K"
            onClick={onCommandPaletteOpen}
          >
            <span className="ds-top-bar__command-text">Search · run</span>
            <span className="ds-top-bar__kbd">
              <kbd>⌘</kbd>
              <kbd>K</kbd>
            </span>
          </button>
        ) : null}
        {actions ? <div className="ds-top-bar__actions">{actions}</div> : null}
      </div>
    </header>
  );
}

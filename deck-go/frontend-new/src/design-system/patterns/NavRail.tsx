import type { ReactNode } from "react";
import "./nav-rail.css";

export interface NavRailItem {
  /** Stable identifier; matches `activeId` when active. */
  id: string;
  /** Icon node — typically `<IconAgent size={18} />` from `@/design-system/icons`. */
  icon: ReactNode;
  /** Accessible label, surfaced via title + aria-label on the rail item. */
  label: string;
  /** Click handler. Pattern stays uncontrolled-routed: caller owns navigation. */
  onClick: () => void;
}

export interface NavRailProps {
  /** Optional brand element rendered at the top of the rail. */
  brand?: ReactNode;
  /** Module navigation items. */
  items: NavRailItem[];
  /** Currently active item id, or `null` if none. */
  activeId?: string | null;
  /** Optional footer slot (e.g. settings / profile). */
  footer?: ReactNode;
  /** Optional accessible label for the nav element itself. */
  "aria-label"?: string;
}

/**
 * Pattern: NavRail — 64px-wide vertical rail of module navigation buttons.
 * Hidden below 760px viewport (caller is responsible for surfacing an alternate
 * navigation affordance, typically inside `TopBar`).
 *
 * Stays stateless: caller provides `activeId` and `onClick` per item. The rail
 * does not know about routing libraries.
 */
export function NavRail({ brand, items, activeId, footer, "aria-label": ariaLabel }: NavRailProps) {
  return (
    <nav className="ds-nav-rail" aria-label={ariaLabel ?? "Primary navigation"}>
      {brand ? <div className="ds-nav-rail__brand">{brand}</div> : null}
      <ul className="ds-nav-rail__items">
        {items.map((item) => {
          const isActive = item.id === activeId;
          return (
            <li key={item.id}>
              <button
                type="button"
                className={
                  isActive ? "ds-nav-rail__item ds-nav-rail__item--active" : "ds-nav-rail__item"
                }
                aria-current={isActive ? "page" : undefined}
                aria-label={item.label}
                title={item.label}
                onClick={item.onClick}
              >
                {item.icon}
              </button>
            </li>
          );
        })}
      </ul>
      {footer ? <div className="ds-nav-rail__footer">{footer}</div> : null}
    </nav>
  );
}

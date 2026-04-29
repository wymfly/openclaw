import { useId, useRef, useState, type ReactNode, type RefObject } from "react";
import { useKeyboardNav } from "../hooks/use-keyboard-nav";
import { Popover } from "./Popover";
import "./dropdown-menu.css";

export interface DropdownMenuItem {
  /** Stable id for keys + aria-activedescendant. */
  id: string;
  /** Visible label. Caller supplies copy. */
  label: ReactNode;
  /** Optional supporting text rendered after label. */
  description?: ReactNode;
  /** Optional trailing affordance (e.g. shortcut hint). */
  trailing?: ReactNode;
  /** Item-level icon (left). */
  icon?: ReactNode;
  /** When true, item cannot be activated and is skipped by ArrowKey nav. */
  disabled?: boolean;
}

export interface DropdownMenuProps {
  open: boolean;
  onClose: () => void;
  /** The trigger that anchors positioning. */
  anchorRef: RefObject<HTMLElement | null>;
  items: ReadonlyArray<DropdownMenuItem>;
  /** Called when user activates an item (Enter / click). */
  onSelect: (id: string) => void;
  /** Required group label for screen-readers. */
  "aria-label": string;
  className?: string;
}

/**
 * Overlay atom: anchored menu of selectable items. Vertical ArrowKey nav with
 * disabled-skip; Enter/Space activates; Escape closes (via Popover).
 */
export function DropdownMenu({
  open,
  onClose,
  anchorRef,
  items,
  onSelect,
  "aria-label": ariaLabel,
  className,
}: DropdownMenuProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const labelId = useId();

  const onKeyDown = useKeyboardNav({
    items,
    activeIndex,
    onActiveIndexChange: setActiveIndex,
    orientation: "vertical",
    loop: true,
  });

  function activate(id: string, disabled?: boolean): void {
    if (disabled) {
      return;
    }
    onSelect(id);
  }

  return (
    <Popover open={open} onClose={onClose} anchorRef={anchorRef} aria-labelledby={labelId}>
      <div className="ds-dropdown-menu__head" id={labelId}>
        {ariaLabel}
      </div>
      <ul
        ref={listRef}
        role="menu"
        aria-label={ariaLabel}
        className={className ? `ds-dropdown-menu ${className}` : "ds-dropdown-menu"}
        tabIndex={-1}
        onKeyDown={(event) => {
          onKeyDown(event);
          if (event.key === "Enter" || event.key === " ") {
            const item = items[activeIndex];
            if (item) {
              event.preventDefault();
              activate(item.id, item.disabled);
            }
          }
        }}
      >
        {items.map((item, index) => {
          const active = index === activeIndex;
          const classes = ["ds-dropdown-menu__item"];
          if (active) {
            classes.push("ds-dropdown-menu__item--active");
          }
          if (item.disabled) {
            classes.push("ds-dropdown-menu__item--disabled");
          }
          return (
            <li
              key={item.id}
              role="menuitem"
              aria-disabled={item.disabled || undefined}
              className={classes.join(" ")}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => activate(item.id, item.disabled)}
            >
              {item.icon !== undefined ? (
                <span className="ds-dropdown-menu__icon" aria-hidden="true">
                  {item.icon}
                </span>
              ) : null}
              <span className="ds-dropdown-menu__label">{item.label}</span>
              {item.description !== undefined ? (
                <span className="ds-dropdown-menu__description">{item.description}</span>
              ) : null}
              {item.trailing !== undefined ? (
                <span className="ds-dropdown-menu__trailing">{item.trailing}</span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Popover>
  );
}

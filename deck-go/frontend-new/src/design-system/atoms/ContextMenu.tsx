import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { useClickOutside } from "../hooks/use-click-outside";
import { useEscapeClose } from "../hooks/use-escape-close";
import { useKeyboardNav } from "../hooks/use-keyboard-nav";
import "./context-menu.css";

export interface ContextMenuItem {
  id: string;
  label: ReactNode;
  disabled?: boolean;
  onSelect?: () => void;
}

export interface ContextMenuProps {
  /** Children that, when right-clicked, open the menu at the cursor. */
  children: ReactNode;
  items: ReadonlyArray<ContextMenuItem>;
  /** Required a11y label for the menu region. */
  "aria-label": string;
  /** Optional className for the wrapper around children. */
  className?: string;
}

/**
 * Overlay atom: right-click context menu. Wraps a target region; on
 * `contextmenu` event, opens a menu at the cursor with arrow-key navigation,
 * Enter/Space activation, and Escape close.
 */
export function ContextMenu({
  children,
  items,
  "aria-label": ariaLabel,
  className,
}: ContextMenuProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [activeIndex, setActiveIndex] = useState(0);
  const menuRef = useRef<HTMLUListElement>(null);

  function close(): void {
    setOpen(false);
  }

  useEscapeClose(open, close);
  useClickOutside(menuRef, open, close);

  const onKeyDown = useKeyboardNav({
    items,
    activeIndex,
    onActiveIndexChange: setActiveIndex,
    orientation: "vertical",
    loop: true,
  });

  useEffect(() => {
    if (open) {
      menuRef.current?.focus();
    }
  }, [open]);

  function activate(item: ContextMenuItem): void {
    if (item.disabled) {
      return;
    }
    item.onSelect?.();
    close();
  }

  function onContextMenu(event: MouseEvent<HTMLDivElement>): void {
    event.preventDefault();
    setPosition({ top: event.clientY + window.scrollY, left: event.clientX + window.scrollX });
    setActiveIndex(items.findIndex((item) => !item.disabled));
    setOpen(true);
  }

  return (
    <div className={className} onContextMenu={onContextMenu}>
      {children}
      {open ? (
        <ul
          ref={menuRef}
          role="menu"
          aria-label={ariaLabel}
          tabIndex={-1}
          className="ds-context-menu"
          style={{ top: `${position.top}px`, left: `${position.left}px` }}
          onKeyDown={(event) => {
            onKeyDown(event);
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              const item = items[activeIndex];
              if (item) {
                activate(item);
              }
            }
          }}
        >
          {items.map((item, index) => {
            const active = index === activeIndex;
            const classes = ["ds-context-menu__item"];
            if (active) {
              classes.push("ds-context-menu__item--active");
            }
            if (item.disabled) {
              classes.push("ds-context-menu__item--disabled");
            }
            return (
              <li
                key={item.id}
                role="menuitem"
                aria-disabled={item.disabled || undefined}
                className={classes.join(" ")}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => activate(item)}
              >
                {item.label}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

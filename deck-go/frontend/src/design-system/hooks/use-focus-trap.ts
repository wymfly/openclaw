import { useEffect, type RefObject } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

/**
 * Trap Tab / Shift-Tab focus inside `ref.current` while `active`.
 * Focuses the first focusable on activate; restores the previously-focused
 * element on deactivate / unmount.
 *
 * Used by Modal / Drawer atoms.
 */
export function useFocusTrap<T extends HTMLElement>(
  ref: RefObject<T | null>,
  active: boolean,
): void {
  useEffect(() => {
    if (!active) {
      return undefined;
    }
    const container = ref.current;
    if (!container) {
      return undefined;
    }

    const previousActive = document.activeElement as HTMLElement | null;
    const initialFocusables = Array.from(
      container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    );
    if (initialFocusables.length === 0) {
      container.tabIndex = -1;
      container.focus();
    } else {
      initialFocusables[0]?.focus();
    }

    function handleKey(event: KeyboardEvent): void {
      if (event.key !== "Tab") {
        return;
      }
      const focusables = Array.from(container!.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusables.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const current = document.activeElement;
      if (event.shiftKey && current === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    }
    container.addEventListener("keydown", handleKey);
    return () => {
      container.removeEventListener("keydown", handleKey);
      if (previousActive && typeof previousActive.focus === "function") {
        previousActive.focus();
      }
    };
  }, [ref, active]);
}

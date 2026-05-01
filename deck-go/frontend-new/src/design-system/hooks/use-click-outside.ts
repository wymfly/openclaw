import { useEffect, type RefObject } from "react";

/**
 * Detect mousedown outside `ref.current` while `active`. Calls `onOutside` with the event.
 *
 * Trigger refs (e.g. for popovers) must be excluded by the caller. `usePopover`
 * supplies a callback that ignores clicks inside its trigger.
 */
export function useClickOutside<T extends HTMLElement>(
  ref: RefObject<T | null>,
  active: boolean,
  onOutside: (event: MouseEvent) => void,
): void {
  useEffect(() => {
    if (!active) {
      return undefined;
    }
    function handle(event: MouseEvent): void {
      const node = ref.current;
      if (!node) {
        return;
      }
      if (node.contains(event.target as Node)) {
        return;
      }
      onOutside(event);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [ref, active, onOutside]);
}

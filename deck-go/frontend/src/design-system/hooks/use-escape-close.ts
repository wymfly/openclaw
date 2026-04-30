import { useEffect } from "react";

/**
 * Listen for Escape on document while `active`. Calls `onClose` and stops propagation
 * so the outer-most active overlay handles it first.
 *
 * Used by Modal / Drawer / Popover / DropdownMenu atoms.
 */
export function useEscapeClose(active: boolean, onClose: () => void): void {
  useEffect(() => {
    if (!active) {
      return undefined;
    }
    function handle(event: KeyboardEvent): void {
      if (event.key !== "Escape") {
        return;
      }
      event.stopPropagation();
      onClose();
    }
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, [active, onClose]);
}

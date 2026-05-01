import { useCallback, type KeyboardEvent } from "react";

export interface KeyboardNavItem {
  disabled?: boolean;
}

export interface UseKeyboardNavOptions<T extends KeyboardNavItem> {
  items: ReadonlyArray<T>;
  activeIndex: number;
  onActiveIndexChange: (next: number) => void;
  orientation?: "horizontal" | "vertical";
  loop?: boolean;
}

/**
 * Returns a `keyDown` handler that moves `activeIndex` via Arrow keys, skipping
 * disabled items. Horizontal (Left/Right) or vertical (Up/Down). Optional loop.
 *
 * Used by Tab / SegmentedControl / DropdownMenu / list-based atoms.
 */
export function useKeyboardNav<T extends KeyboardNavItem>(
  options: UseKeyboardNavOptions<T>,
): (event: KeyboardEvent<HTMLElement>) => void {
  const {
    items,
    activeIndex,
    onActiveIndexChange,
    orientation = "horizontal",
    loop = false,
  } = options;

  return useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      const nextKey = orientation === "horizontal" ? "ArrowRight" : "ArrowDown";
      const prevKey = orientation === "horizontal" ? "ArrowLeft" : "ArrowUp";
      const direction = event.key === nextKey ? 1 : event.key === prevKey ? -1 : 0;
      if (direction === 0) {
        return;
      }
      event.preventDefault();

      const total = items.length;
      if (total === 0) {
        return;
      }

      let candidate = activeIndex;
      for (let attempt = 0; attempt < total; attempt += 1) {
        candidate += direction;
        if (loop) {
          candidate = ((candidate % total) + total) % total;
        } else if (candidate < 0 || candidate >= total) {
          return;
        }
        if (!items[candidate]?.disabled) {
          onActiveIndexChange(candidate);
          return;
        }
      }
    },
    [items, activeIndex, onActiveIndexChange, orientation, loop],
  );
}

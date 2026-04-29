import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";

export interface RenderHookResult<T> {
  result: { current: T };
  rerender: () => void;
  unmount: () => void;
}

/**
 * Minimal `renderHook` helper modelled on @testing-library/react-hooks but built
 * on the deck-go test pattern (createRoot + act + jsdom — no @testing-library).
 *
 * The `result.current` reference is mutated on every render of the host
 * component, so reads after `act(...)` automatically reflect the latest hook
 * return value.
 */
export function renderHook<T>(hook: () => T): RenderHookResult<T> {
  const result: { current: T } = { current: undefined as unknown as T };
  function HookHost(): null {
    result.current = hook();
    return null;
  }
  const container = document.createElement("div");
  document.body.appendChild(container);
  let root: Root | null = createRoot(container);
  act(() => {
    root!.render(createElement(HookHost));
  });
  return {
    result,
    rerender: () => {
      if (!root) {
        return;
      }
      act(() => {
        root!.render(createElement(HookHost));
      });
    },
    unmount: () => {
      if (root) {
        act(() => {
          root!.unmount();
        });
        root = null;
      }
      container.remove();
    },
  };
}

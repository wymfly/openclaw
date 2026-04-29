import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";

export interface RenderResult {
  container: HTMLDivElement;
  unmount: () => void;
  rerender: (node: ReactElement) => void;
}

/**
 * Minimal `render` helper for atom tests. Same pattern as the deck-ui shell-chrome
 * tests (createRoot + act, no @testing-library).
 */
export function render(node: ReactElement): RenderResult {
  const container = document.createElement("div");
  document.body.appendChild(container);
  let root: Root | null = createRoot(container);
  act(() => {
    root!.render(node);
  });
  return {
    container,
    rerender: (next: ReactElement) => {
      if (!root) {
        return;
      }
      act(() => {
        root!.render(next);
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

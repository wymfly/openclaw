// @vitest-environment jsdom
import { useRef } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { useFocusTrap } from "../use-focus-trap";
import { renderHook } from "./render-hook";

describe("useFocusTrap", () => {
  let cleanups: Array<() => void> = [];
  afterEach(() => {
    for (const fn of cleanups) {
      fn();
    }
    cleanups = [];
    document.body.innerHTML = "";
  });

  function makeContainerWithButtons(...labels: string[]): HTMLDivElement {
    const container = document.createElement("div");
    document.body.appendChild(container);
    for (const label of labels) {
      const btn = document.createElement("button");
      btn.textContent = label;
      container.appendChild(btn);
    }
    return container;
  }

  function activate(container: HTMLDivElement): { unmount: () => void } {
    const { unmount } = renderHook(() => {
      const ref = useRef<HTMLDivElement | null>(container);
      useFocusTrap(ref, true);
      return ref;
    });
    cleanups.push(unmount);
    return { unmount };
  }

  it("focuses the first focusable on activate", () => {
    const container = makeContainerWithButtons("a", "b");
    activate(container);
    expect(document.activeElement?.textContent).toBe("a");
  });

  it("loops Tab from last to first", () => {
    const container = makeContainerWithButtons("a", "b");
    activate(container);
    const last = container.children[1] as HTMLButtonElement;
    last.focus();
    container.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    expect(document.activeElement?.textContent).toBe("a");
  });

  it("loops Shift-Tab from first to last", () => {
    const container = makeContainerWithButtons("a", "b");
    activate(container);
    const first = container.children[0] as HTMLButtonElement;
    first.focus();
    container.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true }),
    );
    expect(document.activeElement?.textContent).toBe("b");
  });

  it("restores focus on unmount", () => {
    const previousButton = document.createElement("button");
    previousButton.textContent = "prev";
    document.body.appendChild(previousButton);
    previousButton.focus();
    expect(document.activeElement).toBe(previousButton);

    const container = makeContainerWithButtons("a", "b");
    const { unmount } = activate(container);
    expect(document.activeElement?.textContent).toBe("a");
    unmount();
    expect(document.activeElement).toBe(previousButton);
  });
});

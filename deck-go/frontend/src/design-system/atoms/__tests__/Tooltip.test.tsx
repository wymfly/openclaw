// @vitest-environment jsdom
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { Tooltip } from "../Tooltip";
import { expectNoAxeViolations } from "./axe-helper";
import { render } from "./render-component";

describe("Tooltip", () => {
  let cleanups: Array<() => void> = [];
  afterEach(() => {
    for (const fn of cleanups) {
      fn();
    }
    cleanups = [];
  });

  function mount(node: Parameters<typeof render>[0]) {
    const result = render(node);
    cleanups.push(result.unmount);
    return result;
  }

  function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  it("attaches aria-describedby to the anchor child", () => {
    const { container } = mount(
      <Tooltip content="hello">
        <button>T</button>
      </Tooltip>,
    );
    const button = container.querySelector("button") as HTMLButtonElement;
    expect(button.getAttribute("aria-describedby")).toBeTruthy();
  });

  it("appears on mouseenter after openDelay, hides on mouseleave", async () => {
    const { container } = mount(
      <Tooltip content="hi" openDelay={10}>
        <button>T</button>
      </Tooltip>,
    );
    const button = container.querySelector("button") as HTMLButtonElement;
    expect(container.querySelector('[role="tooltip"]')).toBeNull();
    // React 19 delegates mouseenter via mouseover (bubbles) at the root container.
    await act(async () => {
      button.dispatchEvent(
        new MouseEvent("mouseover", { bubbles: true, cancelable: true, relatedTarget: null }),
      );
      await delay(20);
    });
    expect(container.querySelector('[role="tooltip"]')?.textContent).toBe("hi");
    await act(async () => {
      button.dispatchEvent(
        new MouseEvent("mouseout", { bubbles: true, cancelable: true, relatedTarget: null }),
      );
    });
    expect(container.querySelector('[role="tooltip"]')).toBeNull();
  });

  it("appears on focus and hides on blur", async () => {
    const { container } = mount(
      <Tooltip content="x" openDelay={0}>
        <button>T</button>
      </Tooltip>,
    );
    const button = container.querySelector("button") as HTMLButtonElement;
    await act(async () => {
      button.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
      await delay(5);
    });
    expect(container.querySelector('[role="tooltip"]')).not.toBeNull();
    await act(async () => {
      button.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    });
    expect(container.querySelector('[role="tooltip"]')).toBeNull();
  });

  it("has no axe violations", async () => {
    const { container } = mount(
      <Tooltip content="hello">
        <button>Trigger</button>
      </Tooltip>,
    );
    await expectNoAxeViolations(container);
  });
});

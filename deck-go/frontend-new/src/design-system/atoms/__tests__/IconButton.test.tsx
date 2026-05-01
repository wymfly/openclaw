// @vitest-environment jsdom
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IconButton } from "../IconButton";
import { expectNoAxeViolations } from "./axe-helper";
import { render } from "./render-component";

describe("IconButton", () => {
  let cleanups: Array<() => void> = [];
  afterEach(() => {
    for (const fn of cleanups) {
      fn();
    }
    cleanups = [];
  });

  function mount(node: ReactElement): HTMLButtonElement | null {
    const result = render(node);
    cleanups.push(result.unmount);
    return result.container.querySelector("button");
  }

  it("renders the icon child", () => {
    const btn = mount(
      <IconButton aria-label="Close">
        <span data-testid="icon">×</span>
      </IconButton>,
    );
    expect(btn?.querySelector("[data-testid=icon]")?.textContent).toBe("×");
  });

  it("requires aria-label (TypeScript-enforced; runtime asserts presence)", () => {
    const btn = mount(
      <IconButton aria-label="Close">
        <span>×</span>
      </IconButton>,
    );
    expect(btn?.getAttribute("aria-label")).toBe("Close");
  });

  it("defaults to ghost variant", () => {
    const btn = mount(
      <IconButton aria-label="x">
        <span>i</span>
      </IconButton>,
    );
    expect(btn?.className).toContain("ds-icon-button--ghost");
  });

  it("applies variant class", () => {
    const btn = mount(
      <IconButton aria-label="x" variant="danger">
        <span>i</span>
      </IconButton>,
    );
    expect(btn?.className).toContain("ds-icon-button--danger");
  });

  it("forwards onClick", () => {
    const onClick = vi.fn();
    const btn = mount(
      <IconButton aria-label="x" onClick={onClick}>
        <span>i</span>
      </IconButton>,
    );
    btn?.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("supports aria-pressed for toggle controls", () => {
    const btn = mount(
      <IconButton aria-label="Toggle" aria-pressed={true}>
        <span>i</span>
      </IconButton>,
    );
    expect(btn?.getAttribute("aria-pressed")).toBe("true");
  });

  it("has no axe violations", async () => {
    const result = render(
      <IconButton aria-label="Close">
        <span>×</span>
      </IconButton>,
    );
    cleanups.push(result.unmount);
    await expectNoAxeViolations(result.container);
  });
});

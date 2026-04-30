// @vitest-environment jsdom
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Toggle } from "../Toggle";
import { expectNoAxeViolations } from "./axe-helper";
import { render } from "./render-component";

describe("Toggle", () => {
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

  it("renders role=switch with aria-checked + aria-label", () => {
    const { container } = mount(
      <Toggle checked={false} onCheckedChange={() => {}} aria-label="streaming">
        x
      </Toggle>,
    );
    const button = container.querySelector("button") as HTMLButtonElement;
    expect(button.getAttribute("role")).toBe("switch");
    expect(button.getAttribute("aria-checked")).toBe("false");
    expect(button.getAttribute("aria-label")).toBe("streaming");
  });

  it("checked=true applies on modifier and aria-checked=true", () => {
    const { container } = mount(<Toggle checked onCheckedChange={() => {}} aria-label="x" />);
    const button = container.querySelector("button") as HTMLButtonElement;
    expect(button.className).toContain("ds-toggle--on");
    expect(button.getAttribute("aria-checked")).toBe("true");
  });

  it("click invokes onCheckedChange with toggled value", () => {
    const onCheckedChange = vi.fn();
    const { container } = mount(
      <Toggle checked={false} onCheckedChange={onCheckedChange} aria-label="x" />,
    );
    act(() => (container.querySelector("button") as HTMLButtonElement).click());
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("Space key toggles", () => {
    const onCheckedChange = vi.fn();
    const { container } = mount(
      <Toggle checked onCheckedChange={onCheckedChange} aria-label="x" />,
    );
    const button = container.querySelector("button") as HTMLButtonElement;
    act(() => {
      button.dispatchEvent(
        new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true }),
      );
    });
    expect(onCheckedChange).toHaveBeenCalledWith(false);
  });

  it("disabled blocks click and keydown", () => {
    const onCheckedChange = vi.fn();
    const { container } = mount(
      <Toggle checked={false} onCheckedChange={onCheckedChange} disabled aria-label="x" />,
    );
    const button = container.querySelector("button") as HTMLButtonElement;
    act(() => button.click());
    expect(onCheckedChange).not.toHaveBeenCalled();
    expect(button.disabled).toBe(true);
  });

  it("has no axe violations", async () => {
    const { container } = mount(
      <Toggle checked={false} onCheckedChange={() => {}} aria-label="streaming" />,
    );
    await expectNoAxeViolations(container);
  });
});

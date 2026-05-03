// @vitest-environment jsdom
import type { ReactElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { expectNoAxeViolations } from "../../atoms/__tests__/axe-helper";
import { render } from "../../atoms/__tests__/render-component";
import { KbdHint } from "../KbdHint";

describe("KbdHint", () => {
  let cleanups: Array<() => void> = [];
  afterEach(() => {
    for (const fn of cleanups) {
      fn();
    }
    cleanups = [];
  });

  function mount(node: ReactElement) {
    const result = render(node);
    cleanups.push(result.unmount);
    return result;
  }

  it("renders one kbd element per key", () => {
    const { container } = mount(<KbdHint keys={["⌘", "K"]} />);
    const keys = container.querySelectorAll(".ds-kbd-hint__key");
    expect(keys.length).toBe(2);
    expect(keys[0]?.textContent).toBe("⌘");
    expect(keys[1]?.textContent).toBe("K");
  });

  it("default size is sm", () => {
    const { container } = mount(<KbdHint keys={["S"]} />);
    const root = container.querySelector(".ds-kbd-hint");
    expect(root?.className).toContain("ds-kbd-hint--sm");
  });

  it("md size applies the larger class", () => {
    const { container } = mount(<KbdHint keys={["S"]} size="md" />);
    const root = container.querySelector(".ds-kbd-hint");
    expect(root?.className).toContain("ds-kbd-hint--md");
  });

  it("aria-label defaults to a space-joined key sequence", () => {
    const { container } = mount(<KbdHint keys={["⌘", "K"]} />);
    expect(container.querySelector(".ds-kbd-hint")?.getAttribute("aria-label")).toBe("⌘ K");
  });

  it("custom aria-label overrides the default", () => {
    const { container } = mount(<KbdHint keys={["⌘", "K"]} aria-label="Open command palette" />);
    expect(container.querySelector(".ds-kbd-hint")?.getAttribute("aria-label")).toBe(
      "Open command palette",
    );
  });

  it("passes axe", async () => {
    const { container } = mount(<KbdHint keys={["⌘", "S"]} />);
    await expectNoAxeViolations(container);
  });
});

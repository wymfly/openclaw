// @vitest-environment jsdom
import type { ReactElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { Radio } from "../Radio";
import { expectNoAxeViolations } from "./axe-helper";
import { render } from "./render-component";

describe("Radio", () => {
  let cleanups: Array<() => void> = [];
  afterEach(() => {
    for (const fn of cleanups) {
      fn();
    }
    cleanups = [];
  });

  function mount(node: ReactElement): HTMLInputElement | null {
    const result = render(node);
    cleanups.push(result.unmount);
    return result.container.querySelector("input");
  }

  it("renders type=radio with ds-radio class", () => {
    const node = mount(<Radio name="g" value="a" />);
    expect(node?.getAttribute("type")).toBe("radio");
    expect(node?.className).toContain("ds-radio");
  });

  it("forwards name and value", () => {
    const node = mount(<Radio name="kind" value="apple" defaultChecked />);
    expect(node?.getAttribute("name")).toBe("kind");
    expect(node?.getAttribute("value")).toBe("apple");
    expect(node?.checked).toBe(true);
  });

  it("has no axe violations", async () => {
    const result = render(<Radio name="g" value="a" aria-label="apple" />);
    cleanups.push(result.unmount);
    await expectNoAxeViolations(result.container);
  });
});

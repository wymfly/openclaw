// @vitest-environment jsdom
import type { ReactElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { Select } from "../Select";
import { expectNoAxeViolations } from "./axe-helper";
import { render } from "./render-component";

describe("Select", () => {
  let cleanups: Array<() => void> = [];
  afterEach(() => {
    for (const fn of cleanups) {
      fn();
    }
    cleanups = [];
  });

  function mount(node: ReactElement): HTMLSelectElement | null {
    const result = render(node);
    cleanups.push(result.unmount);
    return result.container.querySelector("select");
  }

  it("renders options", () => {
    const node = mount(
      <Select defaultValue="a">
        <option value="a">A</option>
        <option value="b">B</option>
      </Select>,
    );
    expect(node?.querySelectorAll("option").length).toBe(2);
    expect(node?.value).toBe("a");
  });

  it("selectSize=sm applies modifier", () => {
    const node = mount(
      <Select selectSize="sm">
        <option>x</option>
      </Select>,
    );
    expect(node?.className).toContain("ds-select--sm");
  });

  it("invalid sets aria-invalid + modifier", () => {
    const node = mount(
      <Select invalid>
        <option>x</option>
      </Select>,
    );
    expect(node?.className).toContain("ds-select--invalid");
    expect(node?.getAttribute("aria-invalid")).toBe("true");
  });

  it("has no axe violations", async () => {
    const result = render(
      <Select aria-label="kind" defaultValue="a">
        <option value="a">A</option>
        <option value="b">B</option>
      </Select>,
    );
    cleanups.push(result.unmount);
    await expectNoAxeViolations(result.container);
  });
});

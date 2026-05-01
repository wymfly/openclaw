// @vitest-environment jsdom
import type { ReactElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { Input } from "../Input";
import { expectNoAxeViolations } from "./axe-helper";
import { render } from "./render-component";

describe("Input", () => {
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

  it("defaults to type=text and ds-input class", () => {
    const node = mount(<Input />);
    expect(node?.getAttribute("type")).toBe("text");
    expect(node?.className).toContain("ds-input");
  });

  it("respects custom type", () => {
    const node = mount(<Input type="email" />);
    expect(node?.getAttribute("type")).toBe("email");
  });

  it("inputSize=sm applies modifier", () => {
    expect(mount(<Input inputSize="sm" />)?.className).toContain("ds-input--sm");
  });

  it("invalid sets aria-invalid + modifier", () => {
    const node = mount(<Input invalid />);
    expect(node?.className).toContain("ds-input--invalid");
    expect(node?.getAttribute("aria-invalid")).toBe("true");
  });

  it("forwards placeholder/value", () => {
    const node = mount(<Input placeholder="email" defaultValue="x@y.z" />);
    expect(node?.getAttribute("placeholder")).toBe("email");
    expect(node?.value).toBe("x@y.z");
  });

  it("has no axe violations", async () => {
    const result = render(<Input aria-label="email" />);
    cleanups.push(result.unmount);
    await expectNoAxeViolations(result.container);
  });
});

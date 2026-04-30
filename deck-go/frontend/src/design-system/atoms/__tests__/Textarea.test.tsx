// @vitest-environment jsdom
import type { ReactElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { Textarea } from "../Textarea";
import { expectNoAxeViolations } from "./axe-helper";
import { render } from "./render-component";

describe("Textarea", () => {
  let cleanups: Array<() => void> = [];
  afterEach(() => {
    for (const fn of cleanups) {
      fn();
    }
    cleanups = [];
  });

  function mount(node: ReactElement): HTMLTextAreaElement | null {
    const result = render(node);
    cleanups.push(result.unmount);
    return result.container.querySelector("textarea");
  }

  it("renders textarea with ds-textarea class", () => {
    expect(mount(<Textarea />)?.className).toContain("ds-textarea");
  });

  it("invalid sets aria-invalid + modifier", () => {
    const node = mount(<Textarea invalid />);
    expect(node?.className).toContain("ds-textarea--invalid");
    expect(node?.getAttribute("aria-invalid")).toBe("true");
  });

  it("noResize sets ds-textarea--no-resize", () => {
    expect(mount(<Textarea noResize />)?.className).toContain("ds-textarea--no-resize");
  });

  it("forwards rows and placeholder", () => {
    const node = mount(<Textarea rows={4} placeholder="msg" />);
    expect(node?.getAttribute("rows")).toBe("4");
    expect(node?.getAttribute("placeholder")).toBe("msg");
  });

  it("has no axe violations", async () => {
    const result = render(<Textarea aria-label="message" />);
    cleanups.push(result.unmount);
    await expectNoAxeViolations(result.container);
  });
});

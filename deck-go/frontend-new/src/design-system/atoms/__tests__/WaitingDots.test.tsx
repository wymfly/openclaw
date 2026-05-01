// @vitest-environment jsdom
import type { ReactElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { WaitingDots } from "../WaitingDots";
import { expectNoAxeViolations } from "./axe-helper";
import { render } from "./render-component";

describe("WaitingDots", () => {
  let cleanups: Array<() => void> = [];
  afterEach(() => {
    for (const fn of cleanups) {
      fn();
    }
    cleanups = [];
  });

  function mount(node: ReactElement): HTMLSpanElement | null {
    const result = render(node);
    cleanups.push(result.unmount);
    return result.container.querySelector("span");
  }

  it("emits role=status with aria-label", () => {
    const span = mount(<WaitingDots aria-label="Waiting for assistant" />);
    expect(span?.getAttribute("role")).toBe("status");
    expect(span?.getAttribute("aria-label")).toBe("Waiting for assistant");
  });

  it("renders 3 inner dots, each aria-hidden", () => {
    const span = mount(<WaitingDots aria-label="x" />);
    const dots = span?.querySelectorAll(".ds-waiting-dots__dot");
    expect(dots?.length).toBe(3);
    for (const dot of Array.from(dots ?? [])) {
      expect(dot.getAttribute("aria-hidden")).toBe("true");
    }
  });

  it("has no axe violations", async () => {
    const result = render(<WaitingDots aria-label="Waiting for assistant" />);
    cleanups.push(result.unmount);
    await expectNoAxeViolations(result.container);
  });
});

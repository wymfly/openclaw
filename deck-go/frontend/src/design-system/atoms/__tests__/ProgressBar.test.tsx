// @vitest-environment jsdom
import type { ReactElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { ProgressBar } from "../ProgressBar";
import { expectNoAxeViolations } from "./axe-helper";
import { render } from "./render-component";

describe("ProgressBar", () => {
  let cleanups: Array<() => void> = [];
  afterEach(() => {
    for (const fn of cleanups) {
      fn();
    }
    cleanups = [];
  });

  function mount(node: ReactElement): HTMLDivElement | null {
    const result = render(node);
    cleanups.push(result.unmount);
    return result.container.querySelector("[role=progressbar]");
  }

  it("emits role=progressbar with aria-valuemin/max", () => {
    const bar = mount(<ProgressBar aria-label="Loading" value={0.5} />);
    expect(bar?.getAttribute("role")).toBe("progressbar");
    expect(bar?.getAttribute("aria-valuemin")).toBe("0");
    expect(bar?.getAttribute("aria-valuemax")).toBe("1");
    expect(bar?.getAttribute("aria-valuenow")).toBe("0.5");
  });

  it("indeterminate when value is undefined", () => {
    const bar = mount(<ProgressBar aria-label="Loading" />);
    expect(bar?.className).toContain("ds-progress-bar--indeterminate");
    expect(bar?.getAttribute("aria-valuenow")).toBeNull();
  });

  it("clamps value to [0, 1]", () => {
    const tooHigh = mount(<ProgressBar aria-label="x" value={1.5} />);
    expect(tooHigh?.getAttribute("aria-valuenow")).toBe("1");
    const tooLow = mount(<ProgressBar aria-label="x" value={-0.2} />);
    expect(tooLow?.getAttribute("aria-valuenow")).toBe("0");
  });

  it("applies fill width based on value", () => {
    const bar = mount(<ProgressBar aria-label="x" value={0.42} />);
    const fill = bar?.querySelector(".ds-progress-bar__fill") as HTMLDivElement | null;
    expect(fill?.style.width).toBe("42%");
  });

  it("does not set fill width when indeterminate", () => {
    const bar = mount(<ProgressBar aria-label="x" />);
    const fill = bar?.querySelector(".ds-progress-bar__fill") as HTMLDivElement | null;
    expect(fill?.style.width).toBe("");
  });

  it("has no axe violations", async () => {
    const result = render(<ProgressBar aria-label="Loading" value={0.5} />);
    cleanups.push(result.unmount);
    await expectNoAxeViolations(result.container);
  });
});

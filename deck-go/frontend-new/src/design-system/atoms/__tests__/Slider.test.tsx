// @vitest-environment jsdom
import type { ReactElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { Slider } from "../Slider";
import { expectNoAxeViolations } from "./axe-helper";
import { render } from "./render-component";

describe("Slider", () => {
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

  it("renders type=range with aria-label and ds-slider class", () => {
    const node = mount(<Slider aria-label="volume" min={0} max={100} defaultValue={50} step={5} />);
    expect(node?.getAttribute("type")).toBe("range");
    expect(node?.getAttribute("aria-label")).toBe("volume");
    expect(node?.className).toContain("ds-slider");
    expect(node?.getAttribute("min")).toBe("0");
    expect(node?.getAttribute("max")).toBe("100");
    expect(node?.getAttribute("step")).toBe("5");
  });

  it("has no axe violations", async () => {
    const result = render(
      <Slider aria-label="volume" min={0} max={100} defaultValue={50} step={5} />,
    );
    cleanups.push(result.unmount);
    await expectNoAxeViolations(result.container);
  });
});

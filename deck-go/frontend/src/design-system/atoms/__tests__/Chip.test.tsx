// @vitest-environment jsdom
import type { ReactElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { Chip } from "../Chip";
import { expectNoAxeViolations } from "./axe-helper";
import { render } from "./render-component";

describe("Chip", () => {
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

  it("renders children", () => {
    expect(mount(<Chip>cache 71%</Chip>)?.textContent).toBe("cache 71%");
  });

  it("does not apply active class by default", () => {
    expect(mount(<Chip>x</Chip>)?.className).not.toContain("ds-chip--active");
  });

  it("applies active class when active=true", () => {
    expect(mount(<Chip active>x</Chip>)?.className).toContain("ds-chip--active");
  });

  it("has no axe violations", async () => {
    const result = render(<Chip>cache 71%</Chip>);
    cleanups.push(result.unmount);
    await expectNoAxeViolations(result.container);
  });
});

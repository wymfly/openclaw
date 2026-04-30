// @vitest-environment jsdom
import type { ReactElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { StreamingCursor } from "../StreamingCursor";
import { expectNoAxeViolations } from "./axe-helper";
import { render } from "./render-component";

describe("StreamingCursor", () => {
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

  it("is aria-hidden so screen readers skip it", () => {
    expect(mount(<StreamingCursor />)?.getAttribute("aria-hidden")).toBe("true");
  });

  it("applies ds-streaming-cursor class", () => {
    expect(mount(<StreamingCursor />)?.className).toContain("ds-streaming-cursor");
  });

  it("merges caller className", () => {
    expect(mount(<StreamingCursor className="extra" />)?.className).toContain("extra");
  });

  it("has no axe violations", async () => {
    const result = render(<StreamingCursor />);
    cleanups.push(result.unmount);
    await expectNoAxeViolations(result.container);
  });
});

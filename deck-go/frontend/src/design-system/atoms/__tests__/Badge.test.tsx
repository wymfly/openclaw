// @vitest-environment jsdom
import type { ReactElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { Badge } from "../Badge";
import { render } from "./render-component";

describe("Badge", () => {
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
    expect(mount(<Badge>idle</Badge>)?.textContent).toBe("idle");
  });

  it("defaults to neutral variant", () => {
    expect(mount(<Badge>x</Badge>)?.className).toContain("ds-badge--neutral");
  });

  it("applies variant class", () => {
    expect(mount(<Badge variant="err">x</Badge>)?.className).toContain("ds-badge--err");
    expect(mount(<Badge variant="ok">x</Badge>)?.className).toContain("ds-badge--ok");
    expect(mount(<Badge variant="warn">x</Badge>)?.className).toContain("ds-badge--warn");
    expect(mount(<Badge variant="running">x</Badge>)?.className).toContain("ds-badge--running");
  });
});

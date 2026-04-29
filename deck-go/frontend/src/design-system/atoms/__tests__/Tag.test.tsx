// @vitest-environment jsdom
import type { ReactElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { Tag } from "../Tag";
import { render } from "./render-component";

describe("Tag", () => {
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
    expect(mount(<Tag>bash</Tag>)?.textContent).toBe("bash");
  });

  it("applies ds-tag class", () => {
    expect(mount(<Tag>x</Tag>)?.className).toContain("ds-tag");
  });

  it("merges caller className", () => {
    expect(mount(<Tag className="extra">x</Tag>)?.className).toContain("extra");
  });
});

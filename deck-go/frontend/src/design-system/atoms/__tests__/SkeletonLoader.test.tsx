// @vitest-environment jsdom
import type { ReactElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { SkeletonLoader } from "../SkeletonLoader";
import { render } from "./render-component";

describe("SkeletonLoader", () => {
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
    return result.container.querySelector("div");
  }

  it("is aria-hidden so screen readers skip it", () => {
    expect(mount(<SkeletonLoader />)?.getAttribute("aria-hidden")).toBe("true");
  });

  it("applies width and height as inline style", () => {
    const div = mount(<SkeletonLoader width={120} height="1em" />);
    expect(div?.style.width).toBe("120px");
    expect(div?.style.height).toBe("1em");
  });

  it("merges caller style", () => {
    const div = mount(<SkeletonLoader style={{ marginTop: 4 }} />);
    expect(div?.style.marginTop).toBe("4px");
  });
});

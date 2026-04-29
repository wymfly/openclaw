// @vitest-environment jsdom
import type { ReactElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { Spinner } from "../Spinner";
import { render } from "./render-component";

describe("Spinner", () => {
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

  it("emits role=status", () => {
    expect(mount(<Spinner aria-label="Loading" />)?.getAttribute("role")).toBe("status");
  });

  it("requires aria-label (TS-enforced; runtime asserts presence)", () => {
    expect(mount(<Spinner aria-label="Loading messages" />)?.getAttribute("aria-label")).toBe(
      "Loading messages",
    );
  });

  it("applies sm size class", () => {
    expect(mount(<Spinner aria-label="x" size="sm" />)?.className).toContain("ds-spinner--sm");
  });

  it("does not apply size class for default md", () => {
    expect(mount(<Spinner aria-label="x" />)?.className).not.toContain("ds-spinner--sm");
  });
});

// @vitest-environment jsdom
import type { ReactElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { Tab } from "../Tab";
import { render } from "./render-component";

describe("Tab", () => {
  let cleanups: Array<() => void> = [];
  afterEach(() => {
    for (const fn of cleanups) {
      fn();
    }
    cleanups = [];
  });

  function mount(node: ReactElement): HTMLButtonElement | null {
    const result = render(node);
    cleanups.push(result.unmount);
    return result.container.querySelector("button");
  }

  it("renders children with role=tab default", () => {
    const button = mount(<Tab>Sessions</Tab>);
    expect(button?.textContent).toBe("Sessions");
    expect(button?.getAttribute("role")).toBe("tab");
  });

  it("active sets aria-selected=true and tabIndex=0", () => {
    const button = mount(<Tab active>x</Tab>);
    expect(button?.getAttribute("aria-selected")).toBe("true");
    expect(button?.tabIndex).toBe(0);
    expect(button?.className).toContain("ds-tab--active");
  });

  it("inactive: aria-selected=false, tabIndex=-1", () => {
    const button = mount(<Tab>x</Tab>);
    expect(button?.getAttribute("aria-selected")).toBe("false");
    expect(button?.tabIndex).toBe(-1);
  });

  it("muted applies ds-tab--muted modifier", () => {
    expect(mount(<Tab muted>x</Tab>)?.className).toContain("ds-tab--muted");
  });
});

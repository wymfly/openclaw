// @vitest-environment jsdom
import type { ReactElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { Card } from "../Card";
import { render } from "./render-component";

describe("Card", () => {
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

  it("renders children", () => {
    expect(mount(<Card>hello</Card>)?.textContent).toBe("hello");
  });

  it("default surface=elev, padded=true", () => {
    const div = mount(<Card>x</Card>);
    expect(div?.className).toContain("ds-card--elev");
    expect(div?.className).toContain("ds-card--padded");
  });

  it("surface=flat applies ds-card--flat", () => {
    const div = mount(<Card surface="flat">x</Card>);
    expect(div?.className).toContain("ds-card--flat");
  });

  it("padded=false omits padding modifier", () => {
    const div = mount(<Card padded={false}>x</Card>);
    expect(div?.className).not.toContain("ds-card--padded");
  });

  it("forwards extra props (data-*)", () => {
    const div = mount(<Card data-testid="card">x</Card>);
    expect(div?.getAttribute("data-testid")).toBe("card");
  });
});

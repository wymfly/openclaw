// @vitest-environment jsdom
import type { ReactElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { Code } from "../Code";
import { render } from "./render-component";

describe("Code", () => {
  let cleanups: Array<() => void> = [];
  afterEach(() => {
    for (const fn of cleanups) {
      fn();
    }
    cleanups = [];
  });

  function mount(node: ReactElement) {
    const result = render(node);
    cleanups.push(result.unmount);
    return result;
  }

  it("renders content in pre>code", () => {
    const { container } = mount(<Code content="const x = 1" />);
    expect(container.querySelector("pre.ds-code code")?.textContent).toBe("const x = 1");
  });

  it("sets data-language", () => {
    const { container } = mount(<Code content="x" language="ts" />);
    expect(container.querySelector("pre")?.getAttribute("data-language")).toBe("ts");
  });

  it("renders line numbers when showLineNumbers", () => {
    const { container } = mount(<Code content={"a\nb\nc"} showLineNumbers />);
    const lines = container.querySelectorAll(".ds-code__line");
    expect(lines.length).toBe(3);
    const lns = container.querySelectorAll(".ds-code__ln");
    expect(lns[0]?.textContent).toBe("1");
    expect(lns[2]?.textContent).toBe("3");
  });

  it("respects startLine offset", () => {
    const { container } = mount(<Code content={"a\nb"} showLineNumbers startLine={42} />);
    const lns = container.querySelectorAll(".ds-code__ln");
    expect(lns[0]?.textContent).toBe("42");
    expect(lns[1]?.textContent).toBe("43");
  });

  it("forwards aria-label", () => {
    const { container } = mount(<Code content="x" aria-label="snippet" />);
    expect(container.querySelector("pre")?.getAttribute("aria-label")).toBe("snippet");
  });

  it("ds-code--numbered modifier on line-numbered variant", () => {
    const { container } = mount(<Code content="x" showLineNumbers />);
    expect(container.querySelector("pre")?.className).toContain("ds-code--numbered");
  });
});

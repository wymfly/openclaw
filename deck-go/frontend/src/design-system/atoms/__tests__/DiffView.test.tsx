// @vitest-environment jsdom
import type { ReactElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { DiffView } from "../DiffView";
import { render } from "./render-component";

describe("DiffView", () => {
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

  it("parses unified diff content prop", () => {
    const diff = ["@@ -1,3 +1,3 @@", " context", "-old", "+new"].join("\n");
    const { container } = mount(<DiffView content={diff} aria-label="d" />);
    const lines = container.querySelectorAll(".ds-diff__line");
    expect(lines.length).toBe(4);
    expect(lines[0]?.className).toContain("ds-diff__line--hunk");
    expect(lines[1]?.className).toContain("ds-diff__line--context");
    expect(lines[2]?.className).toContain("ds-diff__line--del");
    expect(lines[2]?.querySelector("code")?.textContent).toBe("old");
    expect(lines[3]?.className).toContain("ds-diff__line--add");
    expect(lines[3]?.querySelector("code")?.textContent).toBe("new");
  });

  it("uses pre-parsed lines when provided", () => {
    const { container } = mount(
      <DiffView
        lines={[
          { kind: "add", text: "X" },
          { kind: "del", text: "Y" },
        ]}
      />,
    );
    expect(container.querySelectorAll(".ds-diff__line--add").length).toBe(1);
    expect(container.querySelectorAll(".ds-diff__line--del").length).toBe(1);
  });

  it("renders hunk symbol @, plus +, minus -", () => {
    const { container } = mount(
      <DiffView
        lines={[
          { kind: "hunk", text: "@@ x" },
          { kind: "add", text: "a" },
          { kind: "del", text: "b" },
          { kind: "context", text: "c" },
        ]}
      />,
    );
    const syms = container.querySelectorAll(".ds-diff__sym");
    expect(syms[0]?.textContent).toBe("@");
    expect(syms[1]?.textContent).toBe("+");
    expect(syms[2]?.textContent).toBe("-");
    expect(syms[3]?.textContent).toBe(" ");
  });

  it("forwards aria-label", () => {
    const { container } = mount(<DiffView content="" aria-label="changes" />);
    expect(container.querySelector("pre")?.getAttribute("aria-label")).toBe("changes");
  });
});

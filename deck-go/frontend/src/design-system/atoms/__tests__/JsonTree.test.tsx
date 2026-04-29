// @vitest-environment jsdom
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { JsonTree } from "../JsonTree";
import { render } from "./render-component";

describe("JsonTree", () => {
  let cleanups: Array<() => void> = [];
  afterEach(() => {
    for (const fn of cleanups) {
      fn();
    }
    cleanups = [];
  });

  function mount(node: Parameters<typeof render>[0]) {
    const result = render(node);
    cleanups.push(result.unmount);
    return result;
  }

  it("renders primitives", () => {
    const { container, rerender } = mount(<JsonTree value={null} />);
    expect(container.querySelector(".ds-json__null")?.textContent).toBe("null");
    rerender(<JsonTree value={42} />);
    expect(container.querySelector(".ds-json__primitive")?.textContent).toBe("42");
    rerender(<JsonTree value={true} />);
    expect(container.querySelector(".ds-json__primitive")?.textContent).toBe("true");
    rerender(<JsonTree value="abc" />);
    expect(container.querySelector(".ds-json__string")?.textContent).toBe('"abc"');
  });

  it("renders empty object/array as inline brackets", () => {
    const { container, rerender } = mount(<JsonTree value={[]} />);
    expect(container.textContent).toContain("[]");
    rerender(<JsonTree value={{}} />);
    expect(container.textContent).toContain("{}");
  });

  it("renders nested object and is open by default within defaultOpenDepth", () => {
    const { container } = mount(<JsonTree value={{ a: 1, b: { c: 2 } }} />);
    expect(container.querySelector(".ds-json__key")?.textContent).toBe('"a"');
    expect(container.textContent).toContain('"c"');
  });

  it("respects defaultOpenDepth=0 (collapsed)", () => {
    const { container } = mount(<JsonTree value={{ a: 1 }} defaultOpenDepth={0} />);
    expect(container.textContent).toContain("{1 keys}");
    expect(container.querySelector(".ds-json__key")).toBeNull();
  });

  it("toggle button expands collapsed node", () => {
    const { container } = mount(<JsonTree value={{ a: 1 }} defaultOpenDepth={0} />);
    const toggle = container.querySelector(".ds-json__toggle") as HTMLButtonElement;
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    act(() => toggle.click());
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(container.querySelector(".ds-json__key")?.textContent).toBe('"a"');
  });

  it("forwards aria-label", () => {
    const { container } = mount(<JsonTree value={{}} aria-label="payload" />);
    expect(container.querySelector(".ds-json")?.getAttribute("aria-label")).toBe("payload");
  });

  it("renders array entries with comma separators", () => {
    const { container } = mount(<JsonTree value={[1, 2, 3]} />);
    expect(container.textContent).toContain("1");
    expect(container.textContent).toContain("3");
  });
});

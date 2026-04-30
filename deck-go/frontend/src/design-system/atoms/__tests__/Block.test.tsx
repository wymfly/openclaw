// @vitest-environment jsdom
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Block } from "../Block";
import { render } from "./render-component";

describe("Block", () => {
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

  it("renders label and body", () => {
    const { container } = mount(<Block label="Read">file content</Block>);
    expect(container.querySelector(".ds-block__label")?.textContent).toBe("Read");
    expect(container.querySelector(".ds-block__body")?.textContent).toBe("file content");
  });

  it("renders summary and head actions when provided", () => {
    const { container } = mount(
      <Block label="x" summary="src/foo.ts" headActions={<span data-testid="ha">A</span>}>
        body
      </Block>,
    );
    expect(container.querySelector(".ds-block__summary")?.textContent).toBe("src/foo.ts");
    expect(container.querySelector('[data-testid="ha"]')?.textContent).toBe("A");
  });

  it("static head (collapsible=false) renders div, no aria-expanded", () => {
    const { container } = mount(<Block label="x">body</Block>);
    const head = container.querySelector(".ds-block__head");
    expect(head?.tagName).toBe("DIV");
    expect(head?.getAttribute("aria-expanded")).toBeNull();
  });

  it("collapsible head renders button with aria-expanded", () => {
    const { container } = mount(
      <Block label="x" collapsible defaultOpen>
        body
      </Block>,
    );
    const head = container.querySelector(".ds-block__head");
    expect(head?.tagName).toBe("BUTTON");
    expect(head?.getAttribute("aria-expanded")).toBe("true");
  });

  it("toggling collapsible head hides body", () => {
    const { container } = mount(
      <Block label="x" collapsible defaultOpen>
        body
      </Block>,
    );
    const head = container.querySelector("button.ds-block__head") as HTMLButtonElement;
    expect(container.querySelector(".ds-block__body")).not.toBeNull();
    act(() => head.click());
    expect(container.querySelector(".ds-block__body")).toBeNull();
    expect(head.getAttribute("aria-expanded")).toBe("false");
  });

  it("controlled mode invokes onOpenChange", () => {
    const onOpenChange = vi.fn();
    const { container } = mount(
      <Block label="x" collapsible open onOpenChange={onOpenChange}>
        body
      </Block>,
    );
    const head = container.querySelector("button.ds-block__head") as HTMLButtonElement;
    act(() => head.click());
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(container.querySelector(".ds-block__body")).not.toBeNull();
  });

  it("running=true sets data-running and modifier class", () => {
    const { container } = mount(
      <Block label="x" running>
        body
      </Block>,
    );
    const block = container.querySelector(".ds-block");
    expect(block?.getAttribute("data-running")).toBe("true");
    expect(block?.className).toContain("ds-block--running");
  });

  it("flushBody removes body padding via modifier", () => {
    const { container } = mount(
      <Block label="x" flushBody>
        body
      </Block>,
    );
    expect(container.querySelector(".ds-block__body")?.className).toContain(
      "ds-block__body--flush",
    );
  });

  it("tone=error applies ds-block--error", () => {
    const { container } = mount(
      <Block label="x" tone="error">
        body
      </Block>,
    );
    expect(container.querySelector(".ds-block")?.className).toContain("ds-block--error");
  });

  it("role marker classes are accepted via className passthrough", () => {
    // §10: consumers tag their root with `ds-block--<role>` to participate in
    // the bundle .block cascade pattern. Verify the modifier class names are
    // recognised by the atom (additive, no visual override of consumer chrome).
    const { container } = mount(
      <Block label="x" className="ds-block--tool-use">
        body
      </Block>,
    );
    const block = container.querySelector(".ds-block");
    expect(block?.className).toContain("ds-block--tool-use");
  });
});

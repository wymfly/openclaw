// @vitest-environment jsdom
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SegmentedControl, type SegmentedItem } from "../SegmentedControl";
import { render } from "./render-component";

type View = "raw" | "bash" | "read" | "diff";

const ITEMS: SegmentedItem<View>[] = [
  { value: "raw", label: "Raw" },
  { value: "bash", label: "Bash" },
  { value: "read", label: "Read", disabled: true },
  { value: "diff", label: "Diff" },
];

describe("SegmentedControl", () => {
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

  it("renders role=tablist with aria-label and tabs with aria-selected", () => {
    const { container } = mount(
      <SegmentedControl items={ITEMS} value="raw" onChange={() => {}} aria-label="View" />,
    );
    const list = container.querySelector('[role="tablist"]') as HTMLElement;
    expect(list.getAttribute("aria-label")).toBe("View");
    const tabs = container.querySelectorAll('[role="tab"]');
    expect(tabs.length).toBe(4);
    expect(tabs[0].getAttribute("aria-selected")).toBe("true");
    expect(tabs[1].getAttribute("aria-selected")).toBe("false");
  });

  it("disabled segment is rendered with disabled attribute", () => {
    const { container } = mount(
      <SegmentedControl items={ITEMS} value="raw" onChange={() => {}} aria-label="x" />,
    );
    const tabs = container.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    expect(tabs[2].disabled).toBe(true);
  });

  it("click invokes onChange", () => {
    const onChange = vi.fn();
    const { container } = mount(
      <SegmentedControl items={ITEMS} value="raw" onChange={onChange} aria-label="x" />,
    );
    const tabs = container.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    act(() => tabs[1].click());
    expect(onChange).toHaveBeenCalledWith("bash");
  });

  it("ArrowRight skips disabled segments", () => {
    const onChange = vi.fn();
    const { container } = mount(
      <SegmentedControl items={ITEMS} value="bash" onChange={onChange} aria-label="x" />,
    );
    const list = container.querySelector('[role="tablist"]') as HTMLElement;
    act(() => {
      list.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }),
      );
    });
    expect(onChange).toHaveBeenCalledWith("diff");
  });

  it("ArrowLeft does not loop at start", () => {
    const onChange = vi.fn();
    const { container } = mount(
      <SegmentedControl items={ITEMS} value="raw" onChange={onChange} aria-label="x" />,
    );
    const list = container.querySelector('[role="tablist"]') as HTMLElement;
    act(() => {
      list.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true, cancelable: true }),
      );
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("clicking disabled segment does not invoke onChange", () => {
    const onChange = vi.fn();
    const { container } = mount(
      <SegmentedControl items={ITEMS} value="raw" onChange={onChange} aria-label="x" />,
    );
    const tabs = container.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    act(() => tabs[2].click());
    expect(onChange).not.toHaveBeenCalled();
  });

  it("active tab has tabIndex=0, others -1 (roving tabindex)", () => {
    const { container } = mount(
      <SegmentedControl items={ITEMS} value="bash" onChange={() => {}} aria-label="x" />,
    );
    const tabs = container.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    expect(tabs[0].tabIndex).toBe(-1);
    expect(tabs[1].tabIndex).toBe(0);
    expect(tabs[3].tabIndex).toBe(-1);
  });
});

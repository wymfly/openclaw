// @vitest-environment jsdom
import type { KeyboardEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import { useKeyboardNav } from "../use-keyboard-nav";
import { renderHook } from "./render-hook";

function makeEvent(key: string): KeyboardEvent<HTMLElement> {
  return {
    key,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as KeyboardEvent<HTMLElement>;
}

describe("useKeyboardNav", () => {
  it("ArrowRight advances in horizontal orientation", () => {
    const onChange = vi.fn();
    const { result, unmount } = renderHook(() =>
      useKeyboardNav({
        items: [{}, {}, {}],
        activeIndex: 0,
        onActiveIndexChange: onChange,
        orientation: "horizontal",
      }),
    );
    result.current(makeEvent("ArrowRight"));
    expect(onChange).toHaveBeenCalledWith(1);
    unmount();
  });

  it("skips disabled items", () => {
    const onChange = vi.fn();
    const { result, unmount } = renderHook(() =>
      useKeyboardNav({
        items: [{}, { disabled: true }, {}],
        activeIndex: 0,
        onActiveIndexChange: onChange,
        orientation: "horizontal",
      }),
    );
    result.current(makeEvent("ArrowRight"));
    expect(onChange).toHaveBeenCalledWith(2);
    unmount();
  });

  it("does not loop when loop=false at end", () => {
    const onChange = vi.fn();
    const { result, unmount } = renderHook(() =>
      useKeyboardNav({
        items: [{}, {}],
        activeIndex: 1,
        onActiveIndexChange: onChange,
        orientation: "horizontal",
        loop: false,
      }),
    );
    result.current(makeEvent("ArrowRight"));
    expect(onChange).not.toHaveBeenCalled();
    unmount();
  });

  it("loops when loop=true at end", () => {
    const onChange = vi.fn();
    const { result, unmount } = renderHook(() =>
      useKeyboardNav({
        items: [{}, {}],
        activeIndex: 1,
        onActiveIndexChange: onChange,
        orientation: "horizontal",
        loop: true,
      }),
    );
    result.current(makeEvent("ArrowRight"));
    expect(onChange).toHaveBeenCalledWith(0);
    unmount();
  });

  it("ignores Up/Down in horizontal orientation", () => {
    const onChange = vi.fn();
    const { result, unmount } = renderHook(() =>
      useKeyboardNav({
        items: [{}, {}],
        activeIndex: 0,
        onActiveIndexChange: onChange,
        orientation: "horizontal",
      }),
    );
    result.current(makeEvent("ArrowDown"));
    expect(onChange).not.toHaveBeenCalled();
    unmount();
  });

  it("uses Up/Down in vertical orientation", () => {
    const onChange = vi.fn();
    const { result, unmount } = renderHook(() =>
      useKeyboardNav({
        items: [{}, {}],
        activeIndex: 0,
        onActiveIndexChange: onChange,
        orientation: "vertical",
      }),
    );
    result.current(makeEvent("ArrowDown"));
    expect(onChange).toHaveBeenCalledWith(1);
    unmount();
  });
});

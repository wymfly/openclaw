// @vitest-environment jsdom
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { usePopover } from "../use-popover";
import { renderHook } from "./render-hook";

describe("usePopover", () => {
  let cleanups: Array<() => void> = [];
  afterEach(() => {
    for (const fn of cleanups) {
      fn();
    }
    cleanups = [];
    document.body.innerHTML = "";
  });

  it("initial open defaults to false", () => {
    const { result, unmount } = renderHook(() => usePopover());
    cleanups.push(unmount);
    expect(result.current.open).toBe(false);
  });

  it("respects initialOpen", () => {
    const { result, unmount } = renderHook(() => usePopover({ initialOpen: true }));
    cleanups.push(unmount);
    expect(result.current.open).toBe(true);
  });

  it("toggle flips open state", () => {
    const { result, unmount } = renderHook(() => usePopover());
    cleanups.push(unmount);
    act(() => {
      result.current.toggle();
    });
    expect(result.current.open).toBe(true);
    act(() => {
      result.current.toggle();
    });
    expect(result.current.open).toBe(false);
  });

  it("Escape closes when open", () => {
    const { result, unmount } = renderHook(() => usePopover({ initialOpen: true }));
    cleanups.push(unmount);
    expect(result.current.open).toBe(true);
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(result.current.open).toBe(false);
  });

  it("close sets open to false", () => {
    const { result, unmount } = renderHook(() => usePopover({ initialOpen: true }));
    cleanups.push(unmount);
    act(() => {
      result.current.close();
    });
    expect(result.current.open).toBe(false);
  });
});

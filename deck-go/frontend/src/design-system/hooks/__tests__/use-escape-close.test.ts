// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { useEscapeClose } from "../use-escape-close";
import { renderHook } from "./render-hook";

describe("useEscapeClose", () => {
  let cleanups: Array<() => void> = [];
  afterEach(() => {
    for (const fn of cleanups) {
      fn();
    }
    cleanups = [];
  });

  it("calls onClose when Escape is pressed and active", () => {
    const onClose = vi.fn();
    const { unmount } = renderHook(() => useEscapeClose(true, onClose));
    cleanups.push(unmount);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onClose when inactive", () => {
    const onClose = vi.fn();
    const { unmount } = renderHook(() => useEscapeClose(false, onClose));
    cleanups.push(unmount);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("ignores other keys", () => {
    const onClose = vi.fn();
    const { unmount } = renderHook(() => useEscapeClose(true, onClose));
    cleanups.push(unmount);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("removes listener on unmount", () => {
    const onClose = vi.fn();
    const { unmount } = renderHook(() => useEscapeClose(true, onClose));
    unmount();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(onClose).not.toHaveBeenCalled();
  });
});

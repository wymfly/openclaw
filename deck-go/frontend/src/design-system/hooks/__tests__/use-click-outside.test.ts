// @vitest-environment jsdom
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useClickOutside } from "../use-click-outside";
import { renderHook } from "./render-hook";

describe("useClickOutside", () => {
  let cleanups: Array<() => void> = [];
  afterEach(() => {
    for (const fn of cleanups) {
      fn();
    }
    cleanups = [];
    document.body.innerHTML = "";
  });

  function setup(
    active: boolean,
    onOutside: (event: MouseEvent) => void,
  ): {
    inside: HTMLDivElement;
  } {
    const inside = document.createElement("div");
    inside.id = "inside";
    document.body.appendChild(inside);
    const { unmount } = renderHook(() => {
      const ref = useRef<HTMLDivElement | null>(inside);
      useClickOutside(ref, active, onOutside);
      return ref;
    });
    cleanups.push(unmount);
    return { inside };
  }

  it("calls onOutside when mousedown happens outside the ref", () => {
    const onOutside = vi.fn();
    setup(true, onOutside);
    const outside = document.createElement("div");
    document.body.appendChild(outside);
    outside.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(onOutside).toHaveBeenCalledTimes(1);
  });

  it("does not call onOutside when mousedown is inside the ref", () => {
    const onOutside = vi.fn();
    const { inside } = setup(true, onOutside);
    inside.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(onOutside).not.toHaveBeenCalled();
  });

  it("does nothing when inactive", () => {
    const onOutside = vi.fn();
    setup(false, onOutside);
    const outside = document.createElement("div");
    document.body.appendChild(outside);
    outside.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(onOutside).not.toHaveBeenCalled();
  });
});

// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Toast } from "../Toast";
import { render } from "./render-component";

describe("Toast", () => {
  let cleanups: Array<() => void> = [];
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
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

  it("default variant=info, role=status, aria-live=polite", () => {
    const { container } = mount(<Toast>Saved</Toast>);
    const toast = container.querySelector(".ds-toast") as HTMLElement;
    expect(toast.className).toContain("ds-toast--info");
    expect(toast.getAttribute("role")).toBe("status");
    expect(toast.getAttribute("aria-live")).toBe("polite");
    expect(toast.textContent).toBe("Saved");
  });

  it("error variant defaults to role=alert + aria-live=assertive", () => {
    const { container } = mount(<Toast variant="error">Bang</Toast>);
    const toast = container.querySelector(".ds-toast") as HTMLElement;
    expect(toast.getAttribute("role")).toBe("alert");
    expect(toast.getAttribute("aria-live")).toBe("assertive");
  });

  it("invokes onDismiss after duration ms", () => {
    const onDismiss = vi.fn();
    mount(
      <Toast duration={500} onDismiss={onDismiss}>
        x
      </Toast>,
    );
    expect(onDismiss).not.toHaveBeenCalled();
    vi.advanceTimersByTime(500);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("does not auto-dismiss when duration omitted", () => {
    const onDismiss = vi.fn();
    mount(<Toast onDismiss={onDismiss}>x</Toast>);
    vi.advanceTimersByTime(10000);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("respects explicit role override", () => {
    const { container } = mount(
      <Toast variant="error" role="region">
        x
      </Toast>,
    );
    expect(container.querySelector(".ds-toast")?.getAttribute("role")).toBe("region");
  });
});

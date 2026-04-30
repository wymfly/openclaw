// @vitest-environment jsdom
import { act, useRef, type RefObject } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Popover } from "../Popover";
import { expectNoAxeViolations } from "./axe-helper";
import { render } from "./render-component";

interface HostProps {
  open: boolean;
  onClose: () => void;
}

function Host({ open, onClose }: HostProps) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  return (
    <div>
      <button ref={anchorRef} data-testid="trigger">
        T
      </button>
      <Popover
        open={open}
        onClose={onClose}
        anchorRef={anchorRef as RefObject<HTMLElement | null>}
        aria-label="menu"
      >
        <div data-testid="content">content</div>
      </Popover>
    </div>
  );
}

describe("Popover", () => {
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

  it("renders nothing when open=false", () => {
    const { container } = mount(<Host open={false} onClose={() => {}} />);
    expect(container.querySelector(".ds-popover")).toBeNull();
  });

  it("renders dialog with role=dialog and aria-label when open", () => {
    const { container } = mount(<Host open onClose={() => {}} />);
    const dialog = container.querySelector(".ds-popover");
    expect(dialog?.getAttribute("role")).toBe("dialog");
    expect(dialog?.getAttribute("aria-label")).toBe("menu");
    expect(container.querySelector('[data-testid="content"]')).not.toBeNull();
  });

  it("Escape closes", () => {
    const onClose = vi.fn();
    mount(<Host open onClose={onClose} />);
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("click outside (not anchor or content) closes", () => {
    const onClose = vi.fn();
    const { container } = mount(<Host open onClose={onClose} />);
    // Add a sibling element outside both content and trigger
    const outside = document.createElement("div");
    container.appendChild(outside);
    act(() => {
      outside.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("click on anchor (trigger) does not close", () => {
    const onClose = vi.fn();
    const { container } = mount(<Host open onClose={onClose} />);
    const trigger = container.querySelector('[data-testid="trigger"]') as HTMLElement;
    act(() => {
      trigger.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("click inside content does not close", () => {
    const onClose = vi.fn();
    const { container } = mount(<Host open onClose={onClose} />);
    const content = container.querySelector('[data-testid="content"]') as HTMLElement;
    act(() => {
      content.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("has no axe violations", async () => {
    const { container } = mount(<Host open onClose={() => {}} />);
    await expectNoAxeViolations(container);
  });
});

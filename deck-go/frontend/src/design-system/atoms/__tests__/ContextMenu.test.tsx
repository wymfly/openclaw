// @vitest-environment jsdom
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ContextMenu, type ContextMenuItem } from "../ContextMenu";
import { expectNoAxeViolations } from "./axe-helper";
import { render } from "./render-component";

const ITEMS: ContextMenuItem[] = [
  { id: "copy", label: "Copy", onSelect: () => {} },
  { id: "cut", label: "Cut", disabled: true },
  { id: "paste", label: "Paste" },
];

describe("ContextMenu", () => {
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

  function fireContextMenu(target: HTMLElement): void {
    target.dispatchEvent(
      new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 10, clientY: 20 }),
    );
  }

  it("renders children; menu hidden by default", () => {
    const { container } = mount(
      <ContextMenu items={ITEMS} aria-label="actions">
        <div data-testid="target">target</div>
      </ContextMenu>,
    );
    expect(container.querySelector('[data-testid="target"]')?.textContent).toBe("target");
    expect(container.querySelector('[role="menu"]')).toBeNull();
  });

  it("right-click opens menu at cursor", () => {
    const { container } = mount(
      <ContextMenu items={ITEMS} aria-label="actions">
        <div data-testid="target">target</div>
      </ContextMenu>,
    );
    const target = container.querySelector('[data-testid="target"]') as HTMLElement;
    act(() => fireContextMenu(target));
    const menu = container.querySelector('[role="menu"]') as HTMLElement;
    expect(menu).not.toBeNull();
    expect(menu.getAttribute("aria-label")).toBe("actions");
    expect(menu.style.left).toBe("10px");
  });

  it("clicking an enabled item invokes onSelect and closes", () => {
    const onSelect = vi.fn();
    const items: ContextMenuItem[] = [{ id: "x", label: "X", onSelect }];
    const { container } = mount(
      <ContextMenu items={items} aria-label="m">
        <div data-testid="t">t</div>
      </ContextMenu>,
    );
    const target = container.querySelector('[data-testid="t"]') as HTMLElement;
    act(() => fireContextMenu(target));
    const item = container.querySelector('[role="menuitem"]') as HTMLLIElement;
    act(() => item.click());
    expect(onSelect).toHaveBeenCalled();
    expect(container.querySelector('[role="menu"]')).toBeNull();
  });

  it("clicking a disabled item is no-op (menu stays open, onSelect not called)", () => {
    const onSelect = vi.fn();
    const items: ContextMenuItem[] = [{ id: "x", label: "X", onSelect, disabled: true }];
    const { container } = mount(
      <ContextMenu items={items} aria-label="m">
        <div data-testid="t">t</div>
      </ContextMenu>,
    );
    const target = container.querySelector('[data-testid="t"]') as HTMLElement;
    act(() => fireContextMenu(target));
    const item = container.querySelector('[role="menuitem"]') as HTMLLIElement;
    act(() => item.click());
    expect(onSelect).not.toHaveBeenCalled();
    expect(container.querySelector('[role="menu"]')).not.toBeNull();
  });

  it("Escape closes menu", () => {
    const { container } = mount(
      <ContextMenu items={ITEMS} aria-label="m">
        <div data-testid="t">t</div>
      </ContextMenu>,
    );
    const target = container.querySelector('[data-testid="t"]') as HTMLElement;
    act(() => fireContextMenu(target));
    expect(container.querySelector('[role="menu"]')).not.toBeNull();
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(container.querySelector('[role="menu"]')).toBeNull();
  });

  it("has no axe violations (open menu)", async () => {
    const { container } = mount(
      <ContextMenu items={ITEMS} aria-label="actions">
        <div data-testid="target">target</div>
      </ContextMenu>,
    );
    const target = container.querySelector('[data-testid="target"]') as HTMLElement;
    act(() => fireContextMenu(target));
    await expectNoAxeViolations(container);
  });
});

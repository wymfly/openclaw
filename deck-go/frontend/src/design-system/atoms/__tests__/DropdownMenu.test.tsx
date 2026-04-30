// @vitest-environment jsdom
import { act, useRef, type RefObject } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DropdownMenu, type DropdownMenuItem } from "../DropdownMenu";
import { expectNoAxeViolations } from "./axe-helper";
import { render } from "./render-component";

const ITEMS: DropdownMenuItem[] = [
  { id: "a", label: "Alpha" },
  { id: "b", label: "Beta", disabled: true },
  { id: "c", label: "Charlie" },
];

interface HostProps {
  open: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
}

function Host({ open, onClose, onSelect }: HostProps) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  return (
    <div>
      <button ref={anchorRef}>T</button>
      <DropdownMenu
        open={open}
        onClose={onClose}
        anchorRef={anchorRef as RefObject<HTMLElement | null>}
        items={ITEMS}
        onSelect={onSelect}
        aria-label="Commands"
      />
    </div>
  );
}

describe("DropdownMenu", () => {
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

  it("renders menu with role=menu and items as menuitem", () => {
    const { container } = mount(<Host open onClose={() => {}} onSelect={() => {}} />);
    expect(container.querySelector('[role="menu"]')?.getAttribute("aria-label")).toBe("Commands");
    expect(container.querySelectorAll('[role="menuitem"]').length).toBe(3);
  });

  it("click on enabled item invokes onSelect", () => {
    const onSelect = vi.fn();
    const { container } = mount(<Host open onClose={() => {}} onSelect={onSelect} />);
    const items = container.querySelectorAll<HTMLLIElement>('[role="menuitem"]');
    act(() => items[0].click());
    expect(onSelect).toHaveBeenCalledWith("a");
  });

  it("click on disabled item does not invoke onSelect", () => {
    const onSelect = vi.fn();
    const { container } = mount(<Host open onClose={() => {}} onSelect={onSelect} />);
    const items = container.querySelectorAll<HTMLLIElement>('[role="menuitem"]');
    act(() => items[1].click());
    expect(onSelect).not.toHaveBeenCalled();
    expect(items[1].getAttribute("aria-disabled")).toBe("true");
  });

  it("ArrowDown moves active item, skipping disabled", () => {
    const onSelect = vi.fn();
    const { container } = mount(<Host open onClose={() => {}} onSelect={onSelect} />);
    const menu = container.querySelector('[role="menu"]') as HTMLElement;
    act(() => {
      menu.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }),
      );
    });
    // After 1 ArrowDown from index 0, should land on index 2 (skipping disabled)
    const items = container.querySelectorAll<HTMLLIElement>('[role="menuitem"]');
    expect(items[2].className).toContain("ds-dropdown-menu__item--active");
  });

  it("Enter on active item activates", () => {
    const onSelect = vi.fn();
    const { container } = mount(<Host open onClose={() => {}} onSelect={onSelect} />);
    const menu = container.querySelector('[role="menu"]') as HTMLElement;
    act(() => {
      menu.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
      );
    });
    expect(onSelect).toHaveBeenCalledWith("a");
  });

  it("renders item description and trailing slot", () => {
    const items: DropdownMenuItem[] = [
      { id: "a", label: "X", description: "describe me", trailing: "⌘K" },
    ];
    function H() {
      const r = useRef<HTMLButtonElement>(null);
      return (
        <div>
          <button ref={r}>T</button>
          <DropdownMenu
            open
            onClose={() => {}}
            anchorRef={r as RefObject<HTMLElement | null>}
            items={items}
            onSelect={() => {}}
            aria-label="m"
          />
        </div>
      );
    }
    const { container } = mount(<H />);
    expect(container.querySelector(".ds-dropdown-menu__description")?.textContent).toBe(
      "describe me",
    );
    expect(container.querySelector(".ds-dropdown-menu__trailing")?.textContent).toBe("⌘K");
  });

  it("has no axe violations", async () => {
    const { container } = mount(<Host open onClose={() => {}} onSelect={() => {}} />);
    await expectNoAxeViolations(container);
  });
});

// @vitest-environment jsdom
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IconButton } from "../IconButton";
import { SidebarRow } from "../SidebarRow";
import { expectNoAxeViolations } from "./axe-helper";
import { render } from "./render-component";

describe("SidebarRow", () => {
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

  it("renders title; preview/meta optional", () => {
    const { container } = mount(<SidebarRow title="Session A" preview="hi" meta="2m ago" />);
    expect(container.querySelector(".ds-sidebar-row__title")?.textContent).toBe("Session A");
    expect(container.querySelector(".ds-sidebar-row__preview")?.textContent).toBe("hi");
    expect(container.querySelector(".ds-sidebar-row__meta")?.textContent).toBe("2m ago");
  });

  it("active sets aria-current=true and ds-sidebar-row--active", () => {
    const { container } = mount(<SidebarRow active title="x" />);
    const row = container.querySelector(".ds-sidebar-row") as HTMLElement;
    const button = container.querySelector(".ds-sidebar-row__button") as HTMLButtonElement;
    expect(row.className).toContain("ds-sidebar-row--active");
    expect(button.getAttribute("aria-current")).toBe("true");
  });

  it("streaming applies modifier", () => {
    const { container } = mount(<SidebarRow streaming title="x" />);
    expect(container.querySelector(".ds-sidebar-row")?.className).toContain(
      "ds-sidebar-row--streaming",
    );
  });

  it("trailing slot renders outside the row selection button", () => {
    const { container } = mount(
      <SidebarRow title="x" trailing={<span data-testid="trash">T</span>} />,
    );
    const trailing = container.querySelector(".ds-sidebar-row__trailing") as HTMLElement;
    const selectButton = container.querySelector(".ds-sidebar-row__button") as HTMLButtonElement;
    expect(trailing.querySelector('[data-testid="trash"]')).not.toBeNull();
    expect(selectButton.contains(trailing)).toBe(false);
  });

  it("does not nest interactive trailing actions inside the select button", () => {
    const { container } = mount(
      <SidebarRow
        title="x"
        trailing={
          <IconButton size="sm" aria-label="Delete row">
            x
          </IconButton>
        }
      />,
    );
    const buttons = [...container.querySelectorAll("button")];
    expect(buttons).toHaveLength(2);
    expect(buttons[0]?.contains(buttons[1] ?? null)).toBe(false);
    expect(buttons[1]?.contains(buttons[0] ?? null)).toBe(false);
  });

  it("forwards onClick", () => {
    const onClick = vi.fn();
    const { container } = mount(<SidebarRow title="x" onClick={onClick} />);
    act(() => (container.querySelector(".ds-sidebar-row__button") as HTMLButtonElement).click());
    expect(onClick).toHaveBeenCalled();
  });

  it("inactive omits aria-current", () => {
    const { container } = mount(<SidebarRow title="x" />);
    expect(
      container.querySelector(".ds-sidebar-row__button")?.getAttribute("aria-current"),
    ).toBeNull();
  });

  it("has no axe violations", async () => {
    const { container } = mount(<SidebarRow title="Session A" preview="hi" meta="2m ago" />);
    await expectNoAxeViolations(container);
  });
});

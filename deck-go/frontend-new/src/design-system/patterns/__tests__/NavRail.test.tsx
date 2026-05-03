// @vitest-environment jsdom
import type { ReactElement } from "react";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { expectNoAxeViolations } from "../../atoms/__tests__/axe-helper";
import { render } from "../../atoms/__tests__/render-component";
import { NavRail } from "../NavRail";

describe("NavRail", () => {
  let cleanups: Array<() => void> = [];
  afterEach(() => {
    for (const fn of cleanups) {
      fn();
    }
    cleanups = [];
  });

  function mount(node: ReactElement) {
    const result = render(node);
    cleanups.push(result.unmount);
    return result;
  }

  const items = [
    { id: "a", icon: <span>A</span>, label: "Agents", onClick: () => {} },
    { id: "b", icon: <span>B</span>, label: "Streams", onClick: () => {} },
  ];

  it("renders one button per item with the icon as its content", () => {
    const { container } = mount(<NavRail items={items} activeId="a" />);
    const buttons = container.querySelectorAll(".ds-nav-rail__item");
    expect(buttons.length).toBe(2);
    expect(buttons[0]?.textContent).toBe("A");
  });

  it("active item gets aria-current=page and active class", () => {
    const { container } = mount(<NavRail items={items} activeId="b" />);
    const buttons = container.querySelectorAll<HTMLButtonElement>(".ds-nav-rail__item");
    expect(buttons[0]?.getAttribute("aria-current")).toBeNull();
    expect(buttons[1]?.getAttribute("aria-current")).toBe("page");
    expect(buttons[1]?.className).toContain("ds-nav-rail__item--active");
  });

  it("each button exposes the label via aria-label and title", () => {
    const { container } = mount(<NavRail items={items} activeId="a" />);
    const buttons = container.querySelectorAll<HTMLButtonElement>(".ds-nav-rail__item");
    expect(buttons[0]?.getAttribute("aria-label")).toBe("Agents");
    expect(buttons[0]?.getAttribute("title")).toBe("Agents");
  });

  it("clicking an item invokes its onClick handler", () => {
    const onClick = vi.fn();
    const itemsWithSpy = [{ ...items[0], onClick }, items[1]];
    const { container } = mount(<NavRail items={itemsWithSpy} activeId="b" />);
    const button = container.querySelector<HTMLButtonElement>(".ds-nav-rail__item");
    act(() => {
      button?.click();
    });
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("renders brand and footer slots when provided", () => {
    const { container } = mount(
      <NavRail brand={<div>BRAND</div>} footer={<div>FOOT</div>} items={items} activeId="a" />,
    );
    expect(container.querySelector(".ds-nav-rail__brand")?.textContent).toBe("BRAND");
    expect(container.querySelector(".ds-nav-rail__footer")?.textContent).toBe("FOOT");
  });

  it("passes axe", async () => {
    const { container } = mount(<NavRail items={items} activeId="a" />);
    await expectNoAxeViolations(container);
  });
});

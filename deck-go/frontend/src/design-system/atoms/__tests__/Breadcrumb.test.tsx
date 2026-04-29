// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { Breadcrumb } from "../Breadcrumb";
import { render } from "./render-component";

describe("Breadcrumb", () => {
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

  it("renders nav with default aria-label", () => {
    const { container } = mount(
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Sessions" }]} />,
    );
    const nav = container.querySelector("nav") as HTMLElement;
    expect(nav.getAttribute("aria-label")).toBe("Breadcrumb");
  });

  it("last item is rendered as text with aria-current=page", () => {
    const { container } = mount(
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Sessions" }]} />,
    );
    const items = container.querySelectorAll(".ds-breadcrumb__item");
    expect(items[items.length - 1].querySelector("[aria-current='page']")?.textContent).toBe(
      "Sessions",
    );
  });

  it("non-terminal items render as links", () => {
    const { container } = mount(
      <Breadcrumb
        items={[{ label: "Home", href: "/" }, { label: "X", href: "/x" }, { label: "Y" }]}
      />,
    );
    expect(container.querySelectorAll("a.ds-breadcrumb__link").length).toBe(2);
  });

  it("renders separator between items, not after last", () => {
    const { container } = mount(
      <Breadcrumb items={[{ label: "A", href: "/a" }, { label: "B" }]} separator=">" />,
    );
    const seps = container.querySelectorAll(".ds-breadcrumb__sep");
    expect(seps.length).toBe(1);
    expect(seps[0].textContent).toBe(">");
    expect(seps[0].getAttribute("aria-hidden")).toBe("true");
  });

  it("link onClick fires", () => {
    const onClick = vi.fn();
    const { container } = mount(
      <Breadcrumb items={[{ label: "A", href: "/a", onClick }, { label: "B" }]} />,
    );
    const link = container.querySelector("a.ds-breadcrumb__link") as HTMLAnchorElement;
    // Prevent jsdom navigation noise
    link.addEventListener("click", (event) => event.preventDefault());
    link.click();
    expect(onClick).toHaveBeenCalled();
  });
});

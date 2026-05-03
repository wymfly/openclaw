// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { expectNoAxeViolations } from "../../atoms/__tests__/axe-helper";
import { render } from "../../atoms/__tests__/render-component";
import { IconAgent, IconCheck, IconStream, IconX } from "../index";

describe("design-system/icons accessibility", () => {
  let cleanups: Array<() => void> = [];
  afterEach(() => {
    for (const fn of cleanups) {
      fn();
    }
    cleanups = [];
  });

  function mount(node: React.ReactElement) {
    const result = render(node);
    cleanups.push(result.unmount);
    return result;
  }

  it("default render has aria-hidden=true (decorative)", () => {
    const { container } = mount(<IconAgent />);
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
  });

  it("with aria-label, exposes label and is no longer decorative", () => {
    const { container } = mount(<IconStream aria-label="Live stream" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute("aria-label")).toBe("Live stream");
    expect(svg?.getAttribute("aria-hidden")).not.toBe("true");
  });

  it("decorative icon paired with labeled control passes axe", async () => {
    const { container } = mount(
      <button aria-label="Confirm save">
        <IconCheck size={14} />
      </button>,
    );
    await expectNoAxeViolations(container);
  });

  it("informative icon with aria-label passes axe", async () => {
    const { container } = mount(<IconX aria-label="Close dialog" />);
    await expectNoAxeViolations(container);
  });

  it("size prop produces width and height attributes", () => {
    const { container } = mount(<IconCheck size={20} />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("20");
    expect(svg?.getAttribute("height")).toBe("20");
  });
});

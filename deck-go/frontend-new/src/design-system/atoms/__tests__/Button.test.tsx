// @vitest-environment jsdom
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Button } from "../Button";
import { expectNoAxeViolations } from "./axe-helper";
import { render } from "./render-component";

describe("Button", () => {
  let cleanups: Array<() => void> = [];
  afterEach(() => {
    for (const fn of cleanups) {
      fn();
    }
    cleanups = [];
  });

  function mount(node: ReactElement): HTMLButtonElement | null {
    const result = render(node);
    cleanups.push(result.unmount);
    return result.container.querySelector("button");
  }

  it("renders caller-supplied children (no hardcoded text)", () => {
    const btn = mount(<Button>click me</Button>);
    expect(btn?.textContent).toBe("click me");
  });

  it("applies variant class", () => {
    const btn = mount(<Button variant="danger">x</Button>);
    expect(btn?.className).toContain("ds-button--danger");
  });

  it("defaults to secondary variant", () => {
    const btn = mount(<Button>x</Button>);
    expect(btn?.className).toContain("ds-button--secondary");
  });

  it("applies sm size class", () => {
    const btn = mount(<Button size="sm">x</Button>);
    expect(btn?.className).toContain("ds-button--sm");
  });

  it("does not apply size class for default md", () => {
    const btn = mount(<Button>x</Button>);
    expect(btn?.className).not.toContain("ds-button--sm");
  });

  it("forwards onClick", () => {
    const onClick = vi.fn();
    const btn = mount(<Button onClick={onClick}>x</Button>);
    btn?.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not fire onClick when disabled", () => {
    const onClick = vi.fn();
    const btn = mount(
      <Button onClick={onClick} disabled>
        x
      </Button>,
    );
    btn?.click();
    expect(onClick).not.toHaveBeenCalled();
  });

  it("defaults type to 'button' (avoids accidental submit)", () => {
    const btn = mount(<Button>x</Button>);
    expect(btn?.getAttribute("type")).toBe("button");
  });

  it("respects explicit type=submit", () => {
    const btn = mount(<Button type="submit">x</Button>);
    expect(btn?.getAttribute("type")).toBe("submit");
  });

  it("supports aria-pressed", () => {
    const btn = mount(<Button aria-pressed={true}>x</Button>);
    expect(btn?.getAttribute("aria-pressed")).toBe("true");
  });

  it("merges caller className", () => {
    const btn = mount(<Button className="extra">x</Button>);
    expect(btn?.className).toContain("ds-button");
    expect(btn?.className).toContain("extra");
  });

  it("has no axe violations", async () => {
    const result = render(<Button>click me</Button>);
    cleanups.push(result.unmount);
    await expectNoAxeViolations(result.container);
  });
});

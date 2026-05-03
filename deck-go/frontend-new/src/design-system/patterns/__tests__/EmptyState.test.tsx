// @vitest-environment jsdom
import type { ReactElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { expectNoAxeViolations } from "../../atoms/__tests__/axe-helper";
import { render } from "../../atoms/__tests__/render-component";
import { EmptyState } from "../EmptyState";

describe("EmptyState", () => {
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

  it("renders title and optional description and action", () => {
    const { container } = mount(
      <EmptyState
        title="No agents"
        description="Create the first agent."
        action={<button>Create</button>}
      />,
    );
    expect(container.querySelector(".ds-empty-state__title")?.textContent).toBe("No agents");
    expect(container.querySelector(".ds-empty-state__description")?.textContent).toBe(
      "Create the first agent.",
    );
    expect(container.querySelector(".ds-empty-state__action button")?.textContent).toBe("Create");
  });

  it("does not render description when not provided", () => {
    const { container } = mount(<EmptyState title="Empty" />);
    expect(container.querySelector(".ds-empty-state__description")).toBeNull();
  });

  it("default tone is neutral with role=status", () => {
    const { container } = mount(<EmptyState title="x" />);
    const root = container.querySelector(".ds-empty-state");
    expect(root?.className).toContain("ds-empty-state--neutral");
    expect(root?.getAttribute("role")).toBe("status");
  });

  it("error tone uses role=alert and error class", () => {
    const { container } = mount(<EmptyState title="Failed" tone="error" />);
    const root = container.querySelector(".ds-empty-state");
    expect(root?.className).toContain("ds-empty-state--error");
    expect(root?.getAttribute("role")).toBe("alert");
  });

  it("search tone keeps role=status with search class", () => {
    const { container } = mount(<EmptyState title="No matches" tone="search" />);
    const root = container.querySelector(".ds-empty-state");
    expect(root?.className).toContain("ds-empty-state--search");
    expect(root?.getAttribute("role")).toBe("status");
  });

  it("passes axe in all tones", async () => {
    const { container } = mount(
      <div>
        <EmptyState title="Neutral" description="d" tone="neutral" />
        <EmptyState title="Search" description="d" tone="search" />
        <EmptyState title="Error" description="d" tone="error" />
      </div>,
    );
    await expectNoAxeViolations(container);
  });
});

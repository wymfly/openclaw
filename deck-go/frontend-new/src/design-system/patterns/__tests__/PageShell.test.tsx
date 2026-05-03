// @vitest-environment jsdom
import type { ReactElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { expectNoAxeViolations } from "../../atoms/__tests__/axe-helper";
import { render } from "../../atoms/__tests__/render-component";
import { PageShell } from "../PageShell";

describe("PageShell", () => {
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

  it("renders children inside a centered shell", () => {
    const { container } = mount(<PageShell>Hello</PageShell>);
    const shell = container.querySelector(".ds-page-shell");
    expect(shell?.textContent).toBe("Hello");
  });

  it("default max-width is 1080px via inline custom property", () => {
    const { container } = mount(<PageShell>x</PageShell>);
    const shell = container.querySelector<HTMLElement>(".ds-page-shell");
    expect(shell?.style.getPropertyValue("--ds-page-shell-max")).toBe("1080px");
  });

  it("custom maxWidth applies as inline custom property", () => {
    const { container } = mount(<PageShell maxWidth={720}>x</PageShell>);
    const shell = container.querySelector<HTMLElement>(".ds-page-shell");
    expect(shell?.style.getPropertyValue("--ds-page-shell-max")).toBe("720px");
  });

  it("maxWidth=none removes the centered constraint", () => {
    const { container } = mount(<PageShell maxWidth="none">x</PageShell>);
    const shell = container.querySelector<HTMLElement>(".ds-page-shell");
    expect(shell?.style.getPropertyValue("--ds-page-shell-max")).toBe("100%");
  });

  it("passes axe", async () => {
    const { container } = mount(
      <PageShell>
        <h1>Title</h1>
        <p>Body content</p>
      </PageShell>,
    );
    await expectNoAxeViolations(container);
  });
});

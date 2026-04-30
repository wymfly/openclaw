// @vitest-environment jsdom
import type { ReactElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { Banner } from "../Banner";
import { expectNoAxeViolations } from "./axe-helper";
import { render } from "./render-component";

describe("Banner", () => {
  let cleanups: Array<() => void> = [];
  afterEach(() => {
    for (const fn of cleanups) {
      fn();
    }
    cleanups = [];
  });

  function mount(node: ReactElement): HTMLDivElement | null {
    const result = render(node);
    cleanups.push(result.unmount);
    return result.container.querySelector("div");
  }

  it("renders children", () => {
    expect(mount(<Banner>Reconnecting…</Banner>)?.textContent).toBe("Reconnecting…");
  });

  it("default variant is info, role=status, aria-live=polite", () => {
    const div = mount(<Banner>x</Banner>);
    expect(div?.className).toContain("ds-banner--info");
    expect(div?.getAttribute("role")).toBe("status");
    expect(div?.getAttribute("aria-live")).toBe("polite");
  });

  it("error variant defaults role to alert", () => {
    const div = mount(<Banner variant="error">disconnected</Banner>);
    expect(div?.getAttribute("role")).toBe("alert");
    expect(div?.className).toContain("ds-banner--error");
  });

  it("respects explicit live=assertive", () => {
    const div = mount(
      <Banner variant="error" live="assertive">
        x
      </Banner>,
    );
    expect(div?.getAttribute("aria-live")).toBe("assertive");
  });

  it("respects explicit role override", () => {
    const div = mount(
      <Banner variant="error" role="region" aria-label="Connection status">
        x
      </Banner>,
    );
    expect(div?.getAttribute("role")).toBe("region");
  });

  it("has no axe violations", async () => {
    const result = render(<Banner>Reconnecting…</Banner>);
    cleanups.push(result.unmount);
    await expectNoAxeViolations(result.container);
  });
});

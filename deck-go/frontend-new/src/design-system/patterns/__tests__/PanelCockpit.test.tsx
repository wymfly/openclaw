// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { expectNoAxeViolations } from "../../atoms/__tests__/axe-helper";
import { render } from "../../atoms/__tests__/render-component";
import {
  KpiStrip,
  PanelMetric,
  PanelPill,
  PanelRoot,
  PanelSectionHeader,
  PanelStatusRow,
  PanelSurface,
} from "../PanelCockpit";

const testDir = dirname(fileURLToPath(import.meta.url));
const patternsDir = resolve(testDir, "..");

describe("Panel cockpit patterns", () => {
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

  it("renders a composed dashboard cockpit without module-specific classes", () => {
    const { container } = mount(
      <PanelRoot aria-label="Usage cockpit" data-testid="usage-cockpit" density="compact">
        <PanelSectionHeader
          eyebrow="Usage"
          title="Model usage"
          description="Provider cost, session tokens, and quota pressure."
          actions={
            <PanelStatusRow aria-label="Usage status">
              <PanelPill tone="positive">ready</PanelPill>
              <PanelPill>14d</PanelPill>
            </PanelStatusRow>
          }
        />
        <KpiStrip aria-label="Usage metrics" columns={3}>
          <PanelMetric label="Cost" value="$4.75" hint="latest $3.25" />
          <PanelMetric label="Tokens" value="150" hint="input / output" />
          <PanelMetric label="Pressure" value="90%" tone="warning" hint="OpenAI hourly" />
        </KpiStrip>
        <PanelSurface aria-label="Session drilldown" tone="elevated">
          <PanelSectionHeader headingLevel={3} title="Sessions" meta="2 visible" />
        </PanelSurface>
      </PanelRoot>,
    );

    const root = container.querySelector(".ds-panel-root");
    expect(root?.getAttribute("data-density")).toBe("compact");
    expect(root?.getAttribute("data-testid")).toBe("usage-cockpit");
    expect(root?.className).not.toContain("usage-panel");
    expect(root?.className).not.toContain("sessions-panel");

    const heading = container.querySelector(".ds-panel-section-header__title");
    expect(heading?.tagName).toBe("H2");
    expect(heading?.textContent).toBe("Model usage");

    const metrics = container.querySelectorAll(".ds-panel-metric");
    expect(metrics).toHaveLength(3);
    expect(metrics[0]?.querySelector(".ds-panel-metric__label")?.textContent).toBe("Cost");
    expect(metrics[2]?.getAttribute("data-tone")).toBe("warning");
  });

  it("supports section header levels, metadata, and action rows", () => {
    const { container } = mount(
      <PanelSectionHeader
        headingLevel={4}
        title="Metadata"
        meta={<PanelPill tone="accent">default open</PanelPill>}
        actions={
          <PanelStatusRow>
            <PanelPill tone="positive">ready</PanelPill>
          </PanelStatusRow>
        }
      />,
    );

    expect(container.querySelector(".ds-panel-section-header__title")?.tagName).toBe("H4");
    expect(container.querySelector(".ds-panel-section-header__meta")?.textContent).toContain(
      "default open",
    );
    expect(container.querySelector(".ds-panel-status-row")?.textContent).toContain("ready");
  });

  it("keeps surface and pill variants typed through data attributes", () => {
    const { container } = mount(
      <PanelSurface tone="warning" data-testid="warning-surface">
        <PanelStatusRow align="end">
          <PanelPill tone="danger">hot</PanelPill>
          <PanelPill tone="positive">ok</PanelPill>
        </PanelStatusRow>
      </PanelSurface>,
    );

    const surface = container.querySelector(".ds-panel-surface");
    expect(surface?.getAttribute("data-tone")).toBe("warning");
    expect(surface?.getAttribute("data-testid")).toBe("warning-surface");
    expect(container.querySelector(".ds-panel-status-row")?.getAttribute("data-align")).toBe("end");
    expect(container.querySelector('[data-tone="danger"]')?.textContent).toBe("hot");
  });

  it("passes axe for the composed pattern", async () => {
    const { container } = mount(
      <PanelRoot aria-label="Sessions cockpit">
        <PanelSectionHeader
          title="Sessions"
          description="Inventory, transcript, and inspector workspace."
          actions={
            <PanelStatusRow aria-label="Inventory status">
              <PanelPill tone="positive">ready</PanelPill>
            </PanelStatusRow>
          }
        />
        <KpiStrip aria-label="Session metrics">
          <PanelMetric label="Selected" value="Main Session" hint="sess-main" />
        </KpiStrip>
      </PanelRoot>,
    );

    await expectNoAxeViolations(container);
  });

  it("does not expose className or style escape hatches in public props", () => {
    const source = readFileSync(resolve(patternsDir, "PanelCockpit.tsx"), "utf8");
    expect(source).not.toMatch(/className\??:/);
    expect(source).not.toMatch(/style\??:/);
  });

  it("uses only canonical design-system tokens in cockpit CSS", () => {
    const css = readFileSync(resolve(patternsDir, "panel-cockpit.css"), "utf8");
    expect(css).toContain("--ds-bg-2");
    expect(css).toContain("--ds-font-sans");
    expect(css).not.toMatch(/--surface|--text-(?![1234]\\b)|--line|--card|--accent-1/);
  });
});

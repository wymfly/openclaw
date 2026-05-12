// @vitest-environment jsdom
import { fireEvent, waitFor } from "@testing-library/react";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DataFabricTestProvider } from "../../../data/testing/DataFabricTestProvider";
import { DeckIntlProvider } from "../../../i18n/provider";
import { AlertsPanel } from "./AlertsPanel";

const apiMocks = vi.hoisted(() => ({
  createAlertRule: vi.fn(),
  deleteAlertRule: vi.fn(),
  fetchAlertRules: vi.fn(),
  updateAlertRule: vi.fn(),
}));

vi.mock("@/api", () => apiMocks);
vi.mock("../../../api", () => apiMocks);

let container: HTMLDivElement;
let root: Root | null = null;

function rule(id: string, name: string, enabled = true) {
  return {
    id,
    name,
    entityType: "usage",
    condition: ">=",
    threshold: enabled ? 80 : 95,
    action: enabled ? ("toast" as const) : ("webhook" as const),
    cooldownMs: 60_000,
    lastFiredAt: enabled ? null : "2026-04-24T00:00:00Z",
    enabled,
    createdAt: "2026-04-24T00:00:00Z",
    updatedAt: "2026-04-24T00:00:00Z",
  };
}

function rulesPayload(extra = false) {
  return {
    rules: [
      rule("rule-a", "Usage warning"),
      rule("rule-b", "Usage critical", false),
      ...(extra ? [rule("rule-c", "Created rule")] : []),
    ],
  };
}

function renderAlerts(locale: "en" | "zh" = "en") {
  act(() => {
    root = createRoot(container);
    root.render(
      createElement(
        DataFabricTestProvider,
        null,
        createElement(DeckIntlProvider, { locale }, createElement(AlertsPanel)),
      ),
    );
  });
}

function buttonWithText(text: string) {
  return Array.from(container.querySelectorAll("button")).find((button) =>
    button.textContent?.includes(text),
  );
}

function modalButtonWithText(text: string) {
  const modal = container.querySelector(".alerts-panel__modal");
  return Array.from(modal?.querySelectorAll("button") ?? []).find((button) =>
    button.textContent?.includes(text),
  );
}

function rowWithText(text: string) {
  return Array.from(container.querySelectorAll(".alerts-panel__row")).find((row) =>
    row.textContent?.includes(text),
  ) as HTMLElement | undefined;
}

function tileWithText(text: string) {
  const modal = container.querySelector(".alerts-panel__modal");
  return Array.from(modal?.querySelectorAll("button") ?? []).find(
    (button) => button.textContent?.trim() === text || button.textContent?.includes(text),
  );
}

function submitButton() {
  return container.querySelector<HTMLButtonElement>('.alerts-panel__form button[type="submit"]');
}

describe("AlertsPanel", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    apiMocks.fetchAlertRules.mockResolvedValue(rulesPayload());
    apiMocks.createAlertRule.mockResolvedValue({ rule: rule("rule-c", "Created rule") });
    apiMocks.updateAlertRule.mockImplementation((id: string, patch: { enabled?: boolean }) => ({
      rule: rule(
        id,
        id === "rule-a" ? "Usage warning" : "Usage critical",
        patch.enabled ?? id !== "rule-b",
      ),
    }));
    apiMocks.deleteAlertRule.mockResolvedValue({ ok: true, action: "delete" });
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    root = null;
    container.remove();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("loads alert rules into the alert policy workbench", async () => {
    renderAlerts();

    await waitFor(() => expect(apiMocks.fetchAlertRules).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(container.textContent).toContain("Alerts ready"));

    expect(container.querySelector('.ds-panel-root[data-testid="alerts-panel"]')).toBeTruthy();
    expect(container.querySelector(".alerts-panel__workspace")).toBeTruthy();
    expect(container.querySelector(".ds-kpi-strip")).toBeTruthy();
    expect(container.querySelectorAll(".ds-panel-metric")).toHaveLength(4);
    expect(container.textContent).toContain("Alert Management");
    expect(container.textContent).toContain("Local alert policies");
    expect(container.textContent).toContain("Rule inventory");
    expect(container.textContent).toContain("2 rules");
    expect(container.textContent).toContain("Rules");
    expect(container.textContent).toContain("Condition");
    expect(container.textContent).toContain("Threshold");
    expect(container.textContent).toContain("Last fired");
    expect(container.textContent).toContain("Enabled");
    expect(container.textContent).toContain("Usage warning");
    expect(container.textContent).toContain("Usage critical");
    expect(container.textContent).toContain("Toast");
    expect(container.textContent).toContain("Webhook");

    await act(async () => {
      rowWithText("Usage warning")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Selected");
    expect(container.textContent).toContain("Recent fires");
    expect(container.textContent).toContain("Trigger expression");
    expect(container.textContent).toContain("Action and delivery");
  });

  it("renders recoverable filtered-empty state when alert rules exist", async () => {
    renderAlerts();
    await waitFor(() => expect(apiMocks.fetchAlertRules).toHaveBeenCalledTimes(1));

    const searchInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="alert search"]',
    );
    expect(searchInput).toBeTruthy();
    await act(async () => {
      fireEvent.change(searchInput as HTMLInputElement, { target: { value: "not-an-alert" } });
    });

    expect(container.textContent).toContain("No rules match the current filters");
    expect(container.textContent).toContain("Search: not-an-alert");
    expect(buttonWithText("Clear filters")).toBeTruthy();

    await act(async () => {
      buttonWithText("Clear filters")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect((searchInput as HTMLInputElement).value).toBe("");
    expect(container.textContent).toContain("Usage warning");
    expect(container.textContent).toContain("Usage critical");
  });

  it("creates, toggles, and deletes alert rules through inline workbench actions", async () => {
    apiMocks.fetchAlertRules
      .mockResolvedValueOnce(rulesPayload())
      .mockResolvedValue(rulesPayload(true));

    renderAlerts();

    await waitFor(() => expect(container.textContent).toContain("Alerts ready"));

    await act(async () => {
      buttonWithText("Add Rule")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await act(async () => {
      fireEvent.change(container.querySelector('input[aria-label="alert rule name"]')!, {
        target: { value: "Created rule" },
      });
      tileWithText("cron")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      fireEvent.change(container.querySelector('input[aria-label="alert condition"]')!, {
        target: { value: ">" },
      });
      fireEvent.change(container.querySelector('input[aria-label="alert threshold"]')!, {
        target: { value: "42" },
      });
      tileWithText("Activity")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      fireEvent.change(container.querySelector('input[aria-label="alert cooldown minutes"]')!, {
        target: { value: "2" },
      });
      submitButton()?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.createAlertRule).toHaveBeenCalledWith({
        name: "Created rule",
        entityType: "cron",
        condition: ">",
        threshold: 42,
        action: "activity",
        cooldownMs: 120000,
        enabled: true,
      }),
    );

    const warningRow = rowWithText("Usage warning");
    await act(async () => {
      warningRow?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await act(async () => {
      buttonWithText("Disable rule")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.updateAlertRule).toHaveBeenCalledWith("rule-a", { enabled: false }),
    );

    await act(async () => {
      buttonWithText("Delete Rule")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(apiMocks.deleteAlertRule).not.toHaveBeenCalled();

    await act(async () => {
      modalButtonWithText("Delete this rule?")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    await waitFor(() => expect(apiMocks.deleteAlertRule).toHaveBeenCalledWith("rule-a"));
  });

  it("edits an alert rule through the restored form", async () => {
    renderAlerts();

    await waitFor(() => expect(container.textContent).toContain("Alerts ready"));

    const criticalRow = rowWithText("Usage critical");
    await act(async () => {
      criticalRow?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await act(async () => {
      buttonWithText("Edit Rule")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await act(async () => {
      fireEvent.change(container.querySelector('input[aria-label="alert rule name"]')!, {
        target: { value: "Usage critical edited" },
      });
      tileWithText("agent")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      fireEvent.change(container.querySelector('input[aria-label="alert condition"]')!, {
        target: { value: ">" },
      });
      fireEvent.change(container.querySelector('input[aria-label="alert threshold"]')!, {
        target: { value: "99" },
      });
      tileWithText("Activity")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      fireEvent.change(container.querySelector('input[aria-label="alert cooldown minutes"]')!, {
        target: { value: "5" },
      });
      submitButton()?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.updateAlertRule).toHaveBeenCalledWith("rule-b", {
        name: "Usage critical edited",
        entityType: "agent",
        condition: ">",
        threshold: 99,
        action: "activity",
        cooldownMs: 300000,
        enabled: false,
      }),
    );
  });

  it("classifies fired alert history as unavailable and shows supported last-fired fallback", async () => {
    renderAlerts();

    await waitFor(() => expect(container.textContent).toContain("Alerts ready"));

    await act(async () => {
      rowWithText("Usage critical")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => expect(container.textContent).toContain("Selected"));

    await act(async () => {
      buttonWithText("Recent fires")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain(
      "Fired alert history is not exposed by the Alerts contract",
    );
    expect(container.textContent).toContain("Usage critical");
    expect(container.textContent).toContain("Apr 24");
  });

  it("renders localized alert copy when the Deck locale changes", async () => {
    renderAlerts("zh");

    await waitFor(() => expect(container.textContent).toContain("告警已就绪"));
    expect(container.textContent).toContain("告警管理");
    expect(container.textContent).toContain("上次触发");
    expect(container.textContent).toContain("规则清单");
  });
});

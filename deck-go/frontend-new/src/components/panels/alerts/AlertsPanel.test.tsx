// @vitest-environment jsdom
import { fireEvent, waitFor } from "@testing-library/react";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeckIntlProvider } from "../../../i18n/provider";
import { AlertsPanel } from "./AlertsPanel";

const apiMocks = vi.hoisted(() => ({
  createAlertRule: vi.fn(),
  deleteAlertRule: vi.fn(),
  fetchAlertRules: vi.fn(),
  updateAlertRule: vi.fn(),
}));

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
    root.render(createElement(DeckIntlProvider, { locale }, createElement(AlertsPanel)));
  });
}

function buttonWithText(text: string) {
  return Array.from(container.querySelectorAll("button")).find((button) =>
    button.textContent?.includes(text),
  );
}

function rowWithText(text: string) {
  return Array.from(container.querySelectorAll(".deck-ui-alerts-row")).find((row) =>
    row.textContent?.includes(text),
  ) as HTMLElement | undefined;
}

describe("AlertsPanel", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    apiMocks.fetchAlertRules.mockResolvedValue(rulesPayload());
    apiMocks.createAlertRule.mockResolvedValue({ rule: rule("rule-c", "Created rule") });
    apiMocks.updateAlertRule.mockResolvedValue({ rule: rule("rule-b", "Usage critical") });
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

  it("loads alert rules into the old tabbed management layout", async () => {
    renderAlerts();

    await waitFor(() => expect(apiMocks.fetchAlertRules).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(container.textContent).toContain("Alerts ready"));

    expect(container.querySelector(".deck-ui-control-single.deck-ui-alerts")).toBeTruthy();
    expect(container.querySelector(".deck-ui-control-tabs")).toBeTruthy();
    expect(container.querySelector(".deck-ui-control-panel-body")).toBeTruthy();
    expect(container.textContent).toContain("Alert Management");
    expect(container.textContent).toContain("Fired Alerts");
    expect(container.textContent).toContain("2 rules");
    expect(container.textContent).toContain("1 enabled");
    expect(container.textContent).toContain("Usage warning");
    expect(container.textContent).toContain("Usage critical");
    expect(container.textContent).toContain("Toast Notification");
    expect(container.textContent).toContain("Webhook");
  });

  it("creates, toggles, and deletes alert rules through rule-list actions", async () => {
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
      fireEvent.change(container.querySelector('select[aria-label="alert entity type"]')!, {
        target: { value: "cron" },
      });
      fireEvent.change(container.querySelector('input[aria-label="alert condition"]')!, {
        target: { value: ">" },
      });
      fireEvent.change(container.querySelector('input[aria-label="alert threshold"]')!, {
        target: { value: "42" },
      });
      fireEvent.change(container.querySelector('select[aria-label="alert action"]')!, {
        target: { value: "activity" },
      });
      fireEvent.change(container.querySelector('input[aria-label="alert cooldown minutes"]')!, {
        target: { value: "2" },
      });
      buttonWithText("Add Rule")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
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
      Array.from(warningRow?.querySelectorAll("button") ?? [])
        .find((button) => button.textContent?.includes("Disabled"))
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.updateAlertRule).toHaveBeenCalledWith("rule-a", { enabled: false }),
    );

    await act(async () => {
      Array.from(warningRow?.querySelectorAll("button") ?? [])
        .find((button) => button.textContent?.includes("Delete Rule"))
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => expect(apiMocks.deleteAlertRule).toHaveBeenCalledWith("rule-a"));
    expect(window.confirm).toHaveBeenCalledWith("Are you sure you want to delete this rule?");
  });

  it("edits an alert rule through the restored form", async () => {
    renderAlerts();

    await waitFor(() => expect(container.textContent).toContain("Alerts ready"));

    const criticalRow = rowWithText("Usage critical");
    await act(async () => {
      Array.from(criticalRow?.querySelectorAll("button") ?? [])
        .find((button) => button.textContent?.includes("Edit Rule"))
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await act(async () => {
      fireEvent.change(container.querySelector('input[aria-label="alert rule name"]')!, {
        target: { value: "Usage critical edited" },
      });
      fireEvent.change(container.querySelector('select[aria-label="alert entity type"]')!, {
        target: { value: "agent" },
      });
      fireEvent.change(container.querySelector('input[aria-label="alert condition"]')!, {
        target: { value: ">" },
      });
      fireEvent.change(container.querySelector('input[aria-label="alert threshold"]')!, {
        target: { value: "99" },
      });
      fireEvent.change(container.querySelector('select[aria-label="alert action"]')!, {
        target: { value: "activity" },
      });
      fireEvent.change(container.querySelector('input[aria-label="alert cooldown minutes"]')!, {
        target: { value: "5" },
      });
      buttonWithText("Edit Rule")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
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
      buttonWithText("Fired Alerts")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Unavailable");
    expect(container.textContent).toContain("Fired alert history is not exposed by Gateway");
    expect(container.textContent).toContain("Usage critical");
    expect(container.textContent).toContain("2026-04-24T00:00:00Z");
  });

  it("renders localized alert copy when the Deck locale changes", async () => {
    renderAlerts("zh");

    await waitFor(() => expect(container.textContent).toContain("告警已就绪"));
    expect(container.textContent).toContain("告警管理");
    expect(container.textContent).toContain("触发记录");
  });
});

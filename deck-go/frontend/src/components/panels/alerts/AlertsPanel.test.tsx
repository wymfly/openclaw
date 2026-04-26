// @vitest-environment jsdom
import { fireEvent, waitFor } from "@testing-library/react";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

  it("loads alert rules and selects the first rule by default", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(createElement(AlertsPanel));
    });

    await waitFor(() => expect(apiMocks.fetchAlertRules).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(container.textContent).toContain("Alerts ready"));

    expect(container.querySelector(".deck-ui-alerts")).toBeTruthy();
    expect(container.querySelector(".deck-ui-alerts-card")).toBeTruthy();
    expect(container.querySelector(".deck-ui-alerts-body")).toBeTruthy();
    expect(container.querySelector(".deck-ui-alerts-status-row")).toBeTruthy();
    expect(container.querySelector(".deck-ui-alerts-stats")).toBeTruthy();
    expect(container.querySelector(".deck-ui-alerts-surface")).toBeTruthy();
    expect(container.querySelector(".deck-ui-alerts-form-grid")).toBeTruthy();
    expect(container.querySelector(".deck-ui-alerts-input")).toBeTruthy();
    expect(container.querySelector(".deck-ui-alerts-actions")).toBeTruthy();
    expect(container.querySelector(".deck-ui-alerts-button")).toBeTruthy();
    expect(container.querySelector(".deck-ui-alerts-list")).toBeTruthy();
    expect(container.querySelector(".deck-ui-alerts-row")).toBeTruthy();
    expect(container.querySelector(".deck-ui-alerts-hero")).toBeTruthy();
    expect(container.querySelector(".deck-ui-alerts-detail-stats")).toBeTruthy();
    expect(container.textContent).toContain("2 rules");
    expect(container.textContent).toContain("enabled1");
    expect(container.textContent).toContain("Usage warning");
    expect(container.textContent).toContain("Usage critical");
    expect(container.textContent).toContain("usage >= 80 | action: toast");
    expect(container.textContent).toContain("usage >= 95 | action: webhook");
    expect(container.textContent).toContain("cooldown 1m");
    expect(container.textContent).toContain("last fired never");
    expect(container.textContent).toContain("last fired 2026-04-24T00:00:00Z");

    const selectedButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.className.includes("is-selected"),
    );
    expect(selectedButton?.textContent).toContain("Usage warning");
  });

  it("creates, toggles, and deletes rules while preserving preferred selection", async () => {
    apiMocks.fetchAlertRules
      .mockResolvedValueOnce(rulesPayload())
      .mockResolvedValue(rulesPayload(true));

    await act(async () => {
      root = createRoot(container);
      root.render(createElement(AlertsPanel));
    });

    await waitFor(() => expect(container.textContent).toContain("Alerts ready"));

    const nameInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="alert rule name"]',
    );
    const entitySelect = container.querySelector<HTMLSelectElement>(
      'select[aria-label="alert entity type"]',
    );
    const conditionInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="alert condition"]',
    );
    const thresholdInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="alert threshold"]',
    );
    const actionSelect = container.querySelector<HTMLSelectElement>(
      'select[aria-label="alert action"]',
    );
    const cooldownInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="alert cooldown minutes"]',
    );

    await act(async () => {
      fireEvent.change(nameInput as HTMLInputElement, { target: { value: "Created rule" } });
      fireEvent.change(entitySelect as HTMLSelectElement, { target: { value: "cron" } });
      fireEvent.change(conditionInput as HTMLInputElement, { target: { value: ">" } });
      fireEvent.change(thresholdInput as HTMLInputElement, { target: { value: "42" } });
      fireEvent.change(actionSelect as HTMLSelectElement, { target: { value: "activity" } });
      fireEvent.change(cooldownInput as HTMLInputElement, { target: { value: "2" } });
    });

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Create rule")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
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

    const selectedAfterCreate = Array.from(container.querySelectorAll("button")).find((button) =>
      button.className.includes("is-selected"),
    );
    expect(selectedAfterCreate?.textContent).toContain("Created rule");

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Disable")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.updateAlertRule).toHaveBeenCalledWith("rule-c", { enabled: false }),
    );

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Delete")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => expect(apiMocks.deleteAlertRule).toHaveBeenCalledWith("rule-c"));
    expect(window.confirm).toHaveBeenCalledWith("Delete alert rule rule-c?");
  });

  it("does not delete an alert rule when confirmation is cancelled", async () => {
    vi.mocked(window.confirm).mockReturnValueOnce(false);

    await act(async () => {
      root = createRoot(container);
      root.render(createElement(AlertsPanel));
    });

    await waitFor(() => expect(container.textContent).toContain("Alerts ready"));

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Delete")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(window.confirm).toHaveBeenCalledWith("Delete alert rule rule-a?");
    expect(apiMocks.deleteAlertRule).not.toHaveBeenCalled();
  });

  it("loads selected alert rules into the draft and saves full rule edits", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(createElement(AlertsPanel));
    });

    await waitFor(() => expect(container.textContent).toContain("Alerts ready"));

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent?.includes("Usage critical"))
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Load selected")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const nameInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="alert rule name"]',
    );
    const entitySelect = container.querySelector<HTMLSelectElement>(
      'select[aria-label="alert entity type"]',
    );
    const conditionInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="alert condition"]',
    );
    const thresholdInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="alert threshold"]',
    );
    const actionSelect = container.querySelector<HTMLSelectElement>(
      'select[aria-label="alert action"]',
    );
    const cooldownInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="alert cooldown minutes"]',
    );
    const enabledInput = container.querySelector<HTMLInputElement>('input[type="checkbox"]');

    expect(nameInput?.value).toBe("Usage critical");
    expect(entitySelect?.value).toBe("usage");
    expect(conditionInput?.value).toBe(">=");
    expect(thresholdInput?.value).toBe("95");
    expect(actionSelect?.value).toBe("webhook");
    expect(cooldownInput?.value).toBe("1");
    expect(enabledInput?.checked).toBe(false);

    await act(async () => {
      fireEvent.change(nameInput as HTMLInputElement, {
        target: { value: "Usage critical edited" },
      });
      fireEvent.change(entitySelect as HTMLSelectElement, { target: { value: "agent" } });
      fireEvent.change(conditionInput as HTMLInputElement, { target: { value: ">" } });
      fireEvent.change(thresholdInput as HTMLInputElement, { target: { value: "99" } });
      fireEvent.change(actionSelect as HTMLSelectElement, { target: { value: "activity" } });
      fireEvent.change(cooldownInput as HTMLInputElement, { target: { value: "5" } });
      fireEvent.click(enabledInput as HTMLInputElement);
    });

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Save selected")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.updateAlertRule).toHaveBeenCalledWith("rule-b", {
        name: "Usage critical edited",
        entityType: "agent",
        condition: ">",
        threshold: 99,
        action: "activity",
        cooldownMs: 300000,
        enabled: true,
      }),
    );
  });
});

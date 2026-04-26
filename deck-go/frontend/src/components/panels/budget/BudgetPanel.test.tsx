// @vitest-environment jsdom
import { fireEvent, waitFor } from "@testing-library/react";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BudgetPanel } from "./BudgetPanel";

const apiMocks = vi.hoisted(() => ({
  createBudgetRule: vi.fn(),
  deleteBudgetRule: vi.fn(),
  evaluateBudgetRules: vi.fn(),
  fetchBudgetRules: vi.fn(),
  updateBudgetRule: vi.fn(),
}));

vi.mock("../../../api", () => apiMocks);

let container: HTMLDivElement;
let root: Root | null = null;

function rule(id: string, name: string, enabled = true) {
  return {
    id,
    name,
    scope: "global",
    agentId: enabled ? null : "agent-1",
    taskId: null,
    dimension: enabled ? ("cost" as const) : ("totalTokens" as const),
    warnThreshold: enabled ? 10 : null,
    overThreshold: enabled ? 20 : 1000,
    period: "monthly",
    enabled,
    createdAt: "2026-04-24T00:00:00Z",
    updatedAt: "2026-04-24T00:00:00Z",
  };
}

function rulesPayload(extra = false) {
  return {
    rules: [
      rule("budget-a", "Cost cap"),
      rule("budget-b", "Token cap", false),
      ...(extra ? [rule("budget-c", "Created budget")] : []),
    ],
  };
}

function evaluationsPayload() {
  return {
    evaluations: [
      {
        ruleId: "budget-a",
        ruleName: "Cost cap",
        status: "warn" as const,
        current: 12,
        warnThreshold: 10,
        overThreshold: 20,
        dimension: "cost" as const,
      },
    ],
  };
}

describe("BudgetPanel", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    apiMocks.fetchBudgetRules.mockResolvedValue(rulesPayload());
    apiMocks.evaluateBudgetRules.mockResolvedValue(evaluationsPayload());
    apiMocks.createBudgetRule.mockResolvedValue(rule("budget-c", "Created budget"));
    apiMocks.updateBudgetRule.mockResolvedValue(rule("budget-b", "Token cap"));
    apiMocks.deleteBudgetRule.mockResolvedValue({ ok: true, action: "delete" });
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

  it("loads budget rules, evaluations, and selects the first rule", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(createElement(BudgetPanel));
    });

    await waitFor(() => expect(apiMocks.fetchBudgetRules).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(container.textContent).toContain("Budget ready"));

    expect(container.querySelector(".deck-ui-budget")).toBeTruthy();
    expect(container.querySelector(".deck-ui-budget-card")).toBeTruthy();
    expect(container.querySelector(".deck-ui-budget-body")).toBeTruthy();
    expect(container.querySelector(".deck-ui-budget-status-row")).toBeTruthy();
    expect(container.querySelector(".deck-ui-budget-stats")).toBeTruthy();
    expect(container.querySelector(".deck-ui-budget-surface")).toBeTruthy();
    expect(container.querySelector(".deck-ui-budget-chart")).toBeTruthy();
    expect(container.querySelector(".deck-ui-budget-chart-row")).toBeTruthy();
    expect(container.querySelector(".deck-ui-budget-form-grid")).toBeTruthy();
    expect(container.querySelector(".deck-ui-budget-input")).toBeTruthy();
    expect(container.querySelector(".deck-ui-budget-actions")).toBeTruthy();
    expect(container.querySelector(".deck-ui-budget-button")).toBeTruthy();
    expect(container.querySelector(".deck-ui-budget-list")).toBeTruthy();
    expect(container.querySelector(".deck-ui-budget-row")).toBeTruthy();
    expect(container.querySelector(".deck-ui-budget-hero")).toBeTruthy();
    expect(container.querySelector(".deck-ui-budget-detail-stats")).toBeTruthy();
    expect(apiMocks.evaluateBudgetRules).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("2 rules");
    expect(container.textContent).toContain("evaluations1");
    expect(container.textContent).toContain("Cost cap");
    expect(container.textContent).toContain("Token cap");
    expect(container.textContent).toContain("cost | warn: 10 | over: 20");
    expect(container.textContent).toContain("totalTokens | warn: n/a | over: 1000");
    expect(container.textContent).toContain("Budget status");
    expect(container.textContent).toContain("$12.00 / $20.00");
    expect(container.textContent).toContain("Selected rule status");
    expect(container.textContent).toContain("Evaluation");
    expect((container.querySelector(".deckgo-usage-chart-bar") as HTMLProgressElement).value).toBe(
      60,
    );

    const selectedButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.className.includes("is-selected"),
    );
    expect(selectedButton?.textContent).toContain("Cost cap");
  });

  it("creates, toggles, and deletes rules while preserving preferred selection", async () => {
    apiMocks.fetchBudgetRules
      .mockResolvedValueOnce(rulesPayload())
      .mockResolvedValue(rulesPayload(true));

    await act(async () => {
      root = createRoot(container);
      root.render(createElement(BudgetPanel));
    });

    await waitFor(() => expect(container.textContent).toContain("Budget ready"));

    const nameInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="budget rule name"]',
    );
    const scopeSelect = container.querySelector<HTMLSelectElement>(
      'select[aria-label="budget scope"]',
    );
    const dimensionSelect = container.querySelector<HTMLSelectElement>(
      'select[aria-label="budget dimension"]',
    );
    const periodSelect = container.querySelector<HTMLSelectElement>(
      'select[aria-label="budget period"]',
    );
    const warnInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="budget warn threshold"]',
    );
    const overInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="budget over threshold"]',
    );

    await act(async () => {
      fireEvent.change(nameInput as HTMLInputElement, { target: { value: "Created budget" } });
      fireEvent.change(scopeSelect as HTMLSelectElement, { target: { value: "agent" } });
    });
    const agentInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="budget agent id"]',
    );
    await act(async () => {
      fireEvent.change(agentInput as HTMLInputElement, { target: { value: "agent-created" } });
      fireEvent.change(dimensionSelect as HTMLSelectElement, {
        target: { value: "totalTokens" },
      });
      fireEvent.change(periodSelect as HTMLSelectElement, { target: { value: "daily" } });
      fireEvent.change(warnInput as HTMLInputElement, { target: { value: "100" } });
      fireEvent.change(overInput as HTMLInputElement, { target: { value: "200" } });
    });

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Create rule")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.createBudgetRule).toHaveBeenCalledWith({
        name: "Created budget",
        scope: "agent",
        agentId: "agent-created",
        taskId: null,
        dimension: "totalTokens",
        warnThreshold: 100,
        overThreshold: 200,
        period: "daily",
        enabled: true,
      }),
    );

    const selectedAfterCreate = Array.from(container.querySelectorAll("button")).find((button) =>
      button.className.includes("is-selected"),
    );
    expect(selectedAfterCreate?.textContent).toContain("Created budget");

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Disable")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.updateBudgetRule).toHaveBeenCalledWith("budget-c", { enabled: false }),
    );

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Delete")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => expect(apiMocks.deleteBudgetRule).toHaveBeenCalledWith("budget-c"));
    expect(window.confirm).toHaveBeenCalledWith("Delete budget rule budget-c?");
  });

  it("does not delete a budget rule when confirmation is cancelled", async () => {
    vi.mocked(window.confirm).mockReturnValueOnce(false);

    await act(async () => {
      root = createRoot(container);
      root.render(createElement(BudgetPanel));
    });

    await waitFor(() => expect(container.textContent).toContain("Budget ready"));

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Delete")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(window.confirm).toHaveBeenCalledWith("Delete budget rule budget-a?");
    expect(apiMocks.deleteBudgetRule).not.toHaveBeenCalled();
  });

  it("loads the selected rule into the draft and saves full rule edits", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(createElement(BudgetPanel));
    });

    await waitFor(() => expect(container.textContent).toContain("Budget ready"));

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent?.includes("Token cap"))
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Load selected")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const nameInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="budget rule name"]',
    );
    const scopeSelect = container.querySelector<HTMLSelectElement>(
      'select[aria-label="budget scope"]',
    );
    const periodSelect = container.querySelector<HTMLSelectElement>(
      'select[aria-label="budget period"]',
    );
    const warnInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="budget warn threshold"]',
    );
    const overInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="budget over threshold"]',
    );
    const enabledInput = container.querySelector<HTMLInputElement>('input[type="checkbox"]');

    expect(nameInput?.value).toBe("Token cap");
    expect(scopeSelect?.value).toBe("global");
    expect(container.querySelector('input[aria-label="budget agent id"]')).toBeNull();
    expect(overInput?.value).toBe("1000");
    expect(enabledInput?.checked).toBe(false);

    await act(async () => {
      fireEvent.change(nameInput as HTMLInputElement, { target: { value: "Token cap edited" } });
      fireEvent.change(scopeSelect as HTMLSelectElement, { target: { value: "agent" } });
    });
    const agentInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="budget agent id"]',
    );
    expect(agentInput?.value).toBe("agent-1");

    await act(async () => {
      fireEvent.change(periodSelect as HTMLSelectElement, { target: { value: "weekly" } });
      fireEvent.change(warnInput as HTMLInputElement, { target: { value: "500" } });
      fireEvent.change(overInput as HTMLInputElement, { target: { value: "900" } });
      fireEvent.click(enabledInput as HTMLInputElement);
    });

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Save selected")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.updateBudgetRule).toHaveBeenCalledWith("budget-b", {
        name: "Token cap edited",
        scope: "agent",
        agentId: "agent-1",
        taskId: null,
        dimension: "totalTokens",
        warnThreshold: 500,
        overThreshold: 900,
        period: "weekly",
        enabled: true,
      }),
    );
  });

  it("blocks invalid rule drafts before calling budget mutation routes", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(createElement(BudgetPanel));
    });

    await waitFor(() => expect(container.textContent).toContain("Budget ready"));

    const nameInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="budget rule name"]',
    );
    const scopeSelect = container.querySelector<HTMLSelectElement>(
      'select[aria-label="budget scope"]',
    );
    const warnInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="budget warn threshold"]',
    );

    await act(async () => {
      fireEvent.change(nameInput as HTMLInputElement, { target: { value: "   " } });
    });
    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Create rule")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("create requires a rule name");
    expect(apiMocks.createBudgetRule).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.change(nameInput as HTMLInputElement, { target: { value: "Agent cap" } });
      fireEvent.change(scopeSelect as HTMLSelectElement, { target: { value: "agent" } });
    });
    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Create rule")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("create requires an agent id");
    expect(apiMocks.createBudgetRule).not.toHaveBeenCalled();

    const agentInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="budget agent id"]',
    );
    await act(async () => {
      fireEvent.change(agentInput as HTMLInputElement, { target: { value: "agent-1" } });
      fireEvent.change(warnInput as HTMLInputElement, { target: { value: "-1" } });
    });
    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Create rule")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("create warn threshold must be zero or greater");
    expect(apiMocks.createBudgetRule).not.toHaveBeenCalled();
  });
});

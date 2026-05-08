// @vitest-environment jsdom
import { fireEvent, waitFor } from "@testing-library/react";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DataFabricTestProvider } from "../../../data/testing/DataFabricTestProvider";
import { DeckIntlProvider } from "../../../i18n/provider";
import { BudgetPanel } from "./BudgetPanel";

const apiMocks = vi.hoisted(() => ({
  createBudgetRule: vi.fn(),
  deleteBudgetRule: vi.fn(),
  evaluateBudgetRules: vi.fn(),
  fetchBudgetRules: vi.fn(),
  updateBudgetRule: vi.fn(),
}));

vi.mock("@/api", () => apiMocks);
vi.mock("../../../api", () => apiMocks);

let container: HTMLDivElement;
let root: Root | null = null;

function rule(id: string, name: string, enabled = true) {
  return {
    id,
    name,
    scope: enabled ? "global" : "agent",
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

function renderBudget(locale: "en" | "zh" = "en") {
  act(() => {
    root = createRoot(container);
    root.render(
      createElement(
        DataFabricTestProvider,
        null,
        createElement(DeckIntlProvider, { locale }, createElement(BudgetPanel)),
      ),
    );
  });
}

function buttonWithText(text: string) {
  return Array.from(container.querySelectorAll("button")).find((button) =>
    button.textContent?.includes(text),
  );
}

function formButtonWithText(text: string) {
  const form = container.querySelector("form");
  return Array.from(form?.querySelectorAll("button") ?? []).find((button) =>
    button.textContent?.includes(text),
  );
}

function modalButtonWithText(text: string) {
  const modal = container.querySelector(".budget-panel__modal");
  return Array.from(modal?.querySelectorAll("button") ?? []).find((button) =>
    button.textContent?.includes(text),
  );
}

describe("BudgetPanel", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
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

  it("loads budget rules into the budget governance workbench", async () => {
    renderBudget();

    await waitFor(() => expect(apiMocks.fetchBudgetRules).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(container.textContent).toContain("Budget ready"));

    expect(container.querySelector(".budget-panel")).toBeTruthy();
    expect(container.querySelector(".budget-panel__workspace")).toBeTruthy();
    expect(container.querySelector(".budget-panel__metrics")).toBeTruthy();
    expect(container.querySelector(".budget-panel__definition")).toBeTruthy();
    expect(apiMocks.evaluateBudgetRules).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("Spend and token guardrails");
    expect(container.textContent).toContain("2 rules");
    expect(container.textContent).toContain("Budget Status");
    expect(container.textContent).toContain("Cost cap");
    expect(container.textContent).toContain("Token cap");
    expect(container.textContent).toContain("$12.00");
    expect(container.textContent).toContain("Over Threshold$20.00");
  });

  it("keeps rules visible when budget evaluation is temporarily unavailable", async () => {
    apiMocks.evaluateBudgetRules.mockRejectedValueOnce(new Error("usage cost unavailable"));

    renderBudget();

    await waitFor(() => expect(apiMocks.fetchBudgetRules).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(container.textContent).toContain("Budget ready"));

    expect(container.textContent).toContain("Cost cap");
    expect(container.textContent).toContain("Token cap");
    expect(container.textContent).toContain("usage cost unavailable");
  });

  it("creates a per-agent rule through the restored rule form", async () => {
    apiMocks.fetchBudgetRules
      .mockResolvedValueOnce(rulesPayload())
      .mockResolvedValue(rulesPayload(true));

    renderBudget();

    await waitFor(() => expect(container.textContent).toContain("Budget ready"));

    await act(async () => {
      fireEvent.click(buttonWithText("Create") as HTMLButtonElement);
    });
    await waitFor(() => expect(container.textContent).toContain("New Rule"));

    const nameInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="budget rule name"]',
    );
    const warnInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="budget warn threshold"]',
    );
    const overInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="budget over threshold"]',
    );

    await act(async () => {
      fireEvent.change(nameInput as HTMLInputElement, { target: { value: "Created budget" } });
      fireEvent.click(formButtonWithText("Per Agent") as HTMLButtonElement);
    });

    const agentInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="budget agent id"]',
    );

    await act(async () => {
      fireEvent.change(agentInput as HTMLInputElement, { target: { value: "agent-created" } });
      fireEvent.click(formButtonWithText("Total Tokens") as HTMLButtonElement);
      fireEvent.click(formButtonWithText("Daily") as HTMLButtonElement);
      fireEvent.change(warnInput as HTMLInputElement, { target: { value: "100" } });
      fireEvent.change(overInput as HTMLInputElement, { target: { value: "200" } });
    });
    await act(async () => {
      fireEvent.submit(container.querySelector("form") as HTMLFormElement);
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
    expect(container.textContent).toContain("Created budget");
  });

  it("filters rule inventory by search text and status", async () => {
    renderBudget();

    await waitFor(() => expect(container.textContent).toContain("Budget ready"));

    const catalog = container.querySelector(".budget-panel__catalog") as HTMLElement;
    const searchInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="budget rule search"]',
    );

    await act(async () => {
      fireEvent.change(searchInput as HTMLInputElement, { target: { value: "Token" } });
    });
    expect(catalog.textContent).toContain("Token cap");
    expect(catalog.textContent).not.toContain("Cost cap");

    await act(async () => {
      fireEvent.change(searchInput as HTMLInputElement, { target: { value: "" } });
      fireEvent.click(buttonWithText("Disabled") as HTMLButtonElement);
    });
    expect(catalog.textContent).toContain("Token cap");
    expect(catalog.textContent).not.toContain("Cost cap");
  });

  it("renders recoverable filtered-empty state when budget rules exist", async () => {
    renderBudget();
    await waitFor(() => expect(apiMocks.fetchBudgetRules).toHaveBeenCalledTimes(1));

    const searchInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="budget rule search"]',
    );
    expect(searchInput).toBeTruthy();
    await act(async () => {
      fireEvent.change(searchInput as HTMLInputElement, { target: { value: "not-a-budget" } });
    });

    expect(container.textContent).toContain("No budget rules match the current filters");
    expect(container.textContent).toContain("Search: not-a-budget");
    expect(buttonWithText("Clear filters")).toBeTruthy();

    await act(async () => {
      fireEvent.click(buttonWithText("Clear filters") as HTMLButtonElement);
    });

    expect((searchInput as HTMLInputElement).value).toBe("");
    expect(container.textContent).toContain("Cost cap");
    expect(container.textContent).toContain("Token cap");
  });

  it("keeps invalid warn and over threshold ordering local", async () => {
    renderBudget();

    await waitFor(() => expect(container.textContent).toContain("Budget ready"));

    await act(async () => {
      fireEvent.click(buttonWithText("Create") as HTMLButtonElement);
    });

    const nameInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="budget rule name"]',
    );
    const warnInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="budget warn threshold"]',
    );
    const overInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="budget over threshold"]',
    );

    await act(async () => {
      fireEvent.change(nameInput as HTMLInputElement, { target: { value: "Invalid budget" } });
      fireEvent.change(warnInput as HTMLInputElement, { target: { value: "20" } });
      fireEvent.change(overInput as HTMLInputElement, { target: { value: "10" } });
      fireEvent.submit(container.querySelector("form") as HTMLFormElement);
    });

    expect(container.textContent).toContain("Warn threshold must be lower than over threshold");
    expect(apiMocks.createBudgetRule).not.toHaveBeenCalled();
  });

  it("toggles a selected rule through the current patch route", async () => {
    renderBudget();

    await waitFor(() => expect(container.textContent).toContain("Budget ready"));

    await act(async () => {
      fireEvent.click(buttonWithText("Token cap") as HTMLButtonElement);
    });
    await act(async () => {
      fireEvent.click(buttonWithText("Enable rule") as HTMLButtonElement);
    });
    expect(container.textContent).toContain("Enable Token cap?");
    await act(async () => {
      fireEvent.click(modalButtonWithText("Enable rule") as HTMLButtonElement);
    });

    await waitFor(() =>
      expect(apiMocks.updateBudgetRule).toHaveBeenCalledWith("budget-b", { enabled: true }),
    );
  });

  it("edits and deletes a selected rule with inline confirmation", async () => {
    renderBudget();

    await waitFor(() => expect(container.textContent).toContain("Budget ready"));

    await act(async () => {
      fireEvent.click(buttonWithText("Token cap") as HTMLButtonElement);
    });
    await act(async () => {
      fireEvent.click(buttonWithText("Edit") as HTMLButtonElement);
    });

    expect(container.textContent).toContain("Edit Rule");
    const nameInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="budget rule name"]',
    );
    const warnInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="budget warn threshold"]',
    );

    await act(async () => {
      fireEvent.change(nameInput as HTMLInputElement, { target: { value: "Token cap edited" } });
      fireEvent.change(warnInput as HTMLInputElement, { target: { value: "500" } });
      fireEvent.click(formButtonWithText("Weekly") as HTMLButtonElement);
    });
    await act(async () => {
      fireEvent.submit(container.querySelector("form") as HTMLFormElement);
    });

    await waitFor(() =>
      expect(apiMocks.updateBudgetRule).toHaveBeenCalledWith("budget-b", {
        name: "Token cap edited",
        scope: "agent",
        agentId: "agent-1",
        taskId: null,
        dimension: "totalTokens",
        warnThreshold: 500,
        overThreshold: 1000,
        period: "weekly",
        enabled: false,
      }),
    );

    await act(async () => {
      fireEvent.click(buttonWithText("Token cap") as HTMLButtonElement);
    });
    await act(async () => {
      fireEvent.click(buttonWithText("Delete") as HTMLButtonElement);
    });
    expect(apiMocks.deleteBudgetRule).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(modalButtonWithText("Delete this rule?") as HTMLButtonElement);
    });

    await waitFor(() => expect(apiMocks.deleteBudgetRule).toHaveBeenCalledWith("budget-b"));
  });

  it("renders localized budget copy when the Deck locale changes", async () => {
    renderBudget("zh");

    await waitFor(() => expect(container.textContent).toContain("预算已就绪"));
    expect(container.textContent).toContain("预算状态");
    expect(container.textContent).toContain("2 条规则");
  });
});

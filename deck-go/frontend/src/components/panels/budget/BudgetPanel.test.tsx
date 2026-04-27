// @vitest-environment jsdom
import { fireEvent, waitFor } from "@testing-library/react";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeckIntlProvider } from "../../../i18n/provider";
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
    root.render(createElement(DeckIntlProvider, { locale }, createElement(BudgetPanel)));
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

  it("loads budget rules into the old split sidebar and status workspace", async () => {
    renderBudget();

    await waitFor(() => expect(apiMocks.fetchBudgetRules).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(container.textContent).toContain("Budget ready"));

    expect(container.querySelector(".deck-ui-control-shell.deck-ui-budget")).toBeTruthy();
    expect(container.querySelector(".deck-ui-control-sidebar")).toBeTruthy();
    expect(container.querySelector(".deck-ui-control-detail")).toBeTruthy();
    expect(container.querySelector(".deck-ui-budget-status")).toBeTruthy();
    expect(apiMocks.evaluateBudgetRules).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("2 rules");
    expect(container.textContent).toContain("1 evaluations");
    expect(container.textContent).toContain("Budget Status");
    expect(container.textContent).toContain("Cost cap");
    expect(container.textContent).toContain("Token cap");
    expect(container.textContent).toContain("$12.00");
    expect(container.textContent).toContain("Over Threshold: $20.00");
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

  it("edits and deletes a selected rule with inline confirmation", async () => {
    renderBudget();

    await waitFor(() => expect(container.textContent).toContain("Budget ready"));

    await act(async () => {
      fireEvent.click(buttonWithText("Token cap") as HTMLButtonElement);
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
      fireEvent.click(buttonWithText("Delete this rule?") as HTMLButtonElement);
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

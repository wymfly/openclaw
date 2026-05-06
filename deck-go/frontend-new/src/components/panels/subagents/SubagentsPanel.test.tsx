// @vitest-environment jsdom
import { fireEvent, waitFor } from "@testing-library/react";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeckIntlProvider, type NextIntlClientProviderProps } from "../../../i18n/provider";
import { SubagentsPanel } from "./SubagentsPanel";

const apiMocks = vi.hoisted(() => ({
  fetchAgentsList: vi.fn(),
  fetchAgentSubagentConfig: vi.fn(),
  fetchDeckConfig: vi.fn(),
  fetchSubagentLineage: vi.fn(),
  fetchSubagentRuns: vi.fn(),
  killSubagentRun: vi.fn(),
  steerSubagentRun: vi.fn(),
  updateAgentSubagentConfig: vi.fn(),
}));

const deckUIMocks = vi.hoisted(() => ({
  navigateToAgent: vi.fn(),
  navigateToSession: vi.fn(),
  ui: { setActivePanel: vi.fn() },
}));

vi.mock("../../../api", () => apiMocks);
vi.mock("../../../deck-ui/panel-navigation", () => ({
  navigateToAgent: deckUIMocks.navigateToAgent,
  navigateToSession: deckUIMocks.navigateToSession,
}));
vi.mock("../../../deck-ui/ui-store", () => ({
  useDeckUI: () => deckUIMocks.ui,
}));

let container: HTMLDivElement;
let root: Root | null = null;

const baseTime = Date.UTC(2026, 3, 24, 9, 0, 0);

function renderPanel(locale: NextIntlClientProviderProps["locale"] = "en") {
  act(() => {
    root = createRoot(container);
    root.render(createElement(DeckIntlProvider, { locale }, createElement(SubagentsPanel)));
  });
}

function subagentRuns() {
  return {
    total: 4,
    runs: [
      {
        runId: "run-root",
        childSessionKey: "agent:builder:web-root",
        childAgentId: "builder",
        childAgentName: "Builder Agent",
        requesterSessionKey: "agent:main:web-main",
        requesterAgentId: "main",
        requesterAgentName: "Main Agent",
        task: "Build feature",
        model: "gpt-5.4",
        spawnMode: "blocking",
        depth: 0,
        createdAt: baseTime,
        startedAt: baseTime + 100,
        durationMs: 1200,
        status: "active",
      },
      {
        runId: "run-child",
        childSessionKey: "agent:reviewer:web-child",
        childAgentId: "reviewer",
        childAgentName: "Reviewer Agent",
        requesterSessionKey: "agent:builder:web-root",
        requesterAgentId: "builder",
        requesterAgentName: "Builder Agent",
        task: "Review feature",
        model: "gpt-5.4",
        spawnMode: "background",
        depth: 1,
        createdAt: baseTime + 200,
        startedAt: baseTime + 300,
        endedAt: baseTime + 1200,
        durationMs: 900,
        status: "completed",
        outcome: { ok: true },
      },
      {
        runId: "run-failed",
        childSessionKey: "agent:security:web-failed",
        childAgentId: "security",
        childAgentName: "Security Agent",
        requesterSessionKey: "agent:main:web-main",
        requesterAgentId: "main",
        requesterAgentName: "Main Agent",
        task: "Review risk",
        model: "gpt-5.4",
        spawnMode: "background",
        depth: 1,
        createdAt: baseTime - 1000,
        endedAt: baseTime - 500,
        durationMs: 500,
        status: "failed",
      },
      {
        runId: "run-timeout",
        childSessionKey: "agent:qa:web-timeout",
        childAgentId: "qa",
        childAgentName: "QA Agent",
        requesterSessionKey: "agent:main:web-main",
        requesterAgentId: "main",
        requesterAgentName: "Main Agent",
        task: "Visual check",
        model: "gpt-5.4-mini",
        spawnMode: "blocking",
        depth: 1,
        createdAt: baseTime - 2000,
        endedAt: baseTime - 1000,
        durationMs: 1000,
        status: "timeout",
      },
    ],
  };
}

function lineage(runId = "run-root") {
  return {
    root: {
      sessionKey: "agent:main:web-main",
      agentId: "main",
      agentName: "Main Agent",
    },
    nodes: [
      {
        runId,
        sessionKey: "agent:builder:web-root",
        agentId: "builder",
        agentName: "Builder Agent",
        task: "Build feature",
        depth: 0,
        parentRunId: "",
        status: "active",
      },
      {
        runId: "run-child",
        sessionKey: "agent:reviewer:web-child",
        agentId: "reviewer",
        agentName: "Reviewer Agent",
        task: "Review feature",
        depth: 1,
        parentRunId: runId,
        status: "completed",
      },
    ],
  };
}

function configSnapshot() {
  return {
    config: {
      agents: {
        defaults: {
          subagents: {
            maxChildrenPerAgent: 8,
            maxConcurrent: 4,
            maxSpawnDepth: 2,
            model: "openai/gpt-5.4",
          },
        },
      },
    },
    hash: "cfg-h1",
  };
}

function clickButtonByText(text: string) {
  const button = Array.from(container.querySelectorAll("button")).find(
    (candidate) => candidate.textContent?.trim() === text,
  );
  expect(button).toBeTruthy();
  act(() => {
    button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function clickDialogButtonByText(text: string) {
  const dialog = container.querySelector('[role="dialog"]');
  const button = Array.from(dialog?.querySelectorAll("button") ?? []).find(
    (candidate) => candidate.textContent?.trim() === text,
  );
  expect(button).toBeTruthy();
  act(() => {
    button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

describe("SubagentsPanel", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    apiMocks.fetchAgentsList.mockResolvedValue({
      agents: [
        { id: "builder", name: "Builder Agent" },
        { id: "main", name: "Main Agent" },
        { id: "reviewer", name: "Reviewer Agent" },
        { id: "security", name: "Security Agent" },
        { id: "qa", name: "QA Agent" },
      ],
    });
    apiMocks.fetchAgentSubagentConfig.mockImplementation(async (agentId: string) => ({
      agentId,
      allowAgents: agentId === "main" ? ["builder", "reviewer"] : [],
      allowAny: agentId === "builder",
      allAgents: [
        { id: "builder", name: "Builder Agent" },
        { id: "main", name: "Main Agent" },
        { id: "reviewer", name: "Reviewer Agent" },
        { id: "security", name: "Security Agent" },
      ],
      configHash: `${agentId}-hash`,
      effectiveMaxChildrenPerAgent: agentId === "main" ? 7 : 5,
      effectiveMaxSpawnDepth: agentId === "main" ? 2 : 1,
      model: agentId === "reviewer" ? "openai/gpt-5.4-mini" : undefined,
    }));
    apiMocks.fetchDeckConfig.mockResolvedValue(configSnapshot());
    apiMocks.fetchSubagentRuns.mockResolvedValue(subagentRuns());
    apiMocks.fetchSubagentLineage.mockImplementation(async ({ runId }: { runId?: string }) =>
      lineage(runId || "run-root"),
    );
    apiMocks.killSubagentRun.mockResolvedValue({
      ok: true,
      runId: "run-root",
      childSessionKey: "agent:builder:web-root",
    });
    apiMocks.steerSubagentRun.mockResolvedValue({
      success: true,
      dedupKey: "steer-1",
      newRunId: "run-steer",
    });
    apiMocks.updateAgentSubagentConfig.mockResolvedValue({
      ok: true,
      agentId: "main",
      allowAgents: ["builder"],
      configHash: "main-hash-2",
    });
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

  it("loads runs, renders lineage, and keeps navigation actions wired", async () => {
    renderPanel();

    await waitFor(() =>
      expect(apiMocks.fetchSubagentLineage).toHaveBeenCalledWith({ runId: "run-root" }),
    );

    expect(apiMocks.fetchSubagentRuns).toHaveBeenCalledWith({
      limit: 100,
      status: "all",
    });
    expect(container.textContent).toContain("Subagents ready");
    expect(container.textContent).toContain("Builder Agent");
    expect(container.textContent).toContain("Reviewer Agent");
    expect(container.textContent).toContain("Selected run");
    expect(container.querySelector('[data-testid="subagents-panel"]')).toBeTruthy();
    expect(container.querySelector(".kpi-strip")).toBeTruthy();
    expect(container.querySelectorAll(".row").length).toBeGreaterThanOrEqual(4);

    clickButtonByText("Open child agent");
    expect(deckUIMocks.navigateToAgent).toHaveBeenCalledWith(
      deckUIMocks.ui,
      "builder",
      "subagents",
    );

    clickButtonByText("Open child session");
    expect(deckUIMocks.navigateToSession).toHaveBeenCalledWith(
      deckUIMocks.ui,
      "agent:builder:web-root",
    );

    clickButtonByText("Lineage");
    expect(container.textContent).toContain("Lineage root");
    expect(container.textContent).toContain("agent:main:web-main");
    expect(container.textContent).toContain("Review feature");
  });

  it("opens permissions mode and saves per-agent allow-list through config hash", async () => {
    renderPanel();

    await waitFor(() => expect(apiMocks.fetchAgentSubagentConfig).toHaveBeenCalled());
    clickButtonByText("Per-agent permissions");

    expect(container.textContent).toContain("Global spawn defaults");
    expect(container.textContent).toContain("deck.agents.subagents.set");
    expect(container.textContent).toContain("hash main-hash");

    const editMain = Array.from(container.querySelectorAll("button")).find((button) =>
      button.closest(".row--permission")?.textContent?.includes("Main Agent"),
    );
    expect(editMain).toBeTruthy();
    await act(async () => {
      editMain?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.querySelector('[role="dialog"]')?.textContent).toContain("Edit permissions");
    const reviewerCheckbox = Array.from(container.querySelectorAll<HTMLInputElement>("input")).find(
      (input) => input.closest(".perm-row")?.textContent?.includes("Reviewer Agent"),
    );
    expect(reviewerCheckbox).toBeTruthy();
    await act(async () => {
      fireEvent.click(reviewerCheckbox as HTMLInputElement);
    });
    clickButtonByText("Save permissions");

    await waitFor(() =>
      expect(apiMocks.updateAgentSubagentConfig).toHaveBeenCalledWith("main", {
        allowAgents: ["builder"],
        baseHash: "main-hash",
        model: undefined,
      }),
    );
  });

  it("filters locally and runs steer plus kill through existing action wrappers", async () => {
    renderPanel();

    await waitFor(() =>
      expect(apiMocks.fetchSubagentLineage).toHaveBeenCalledWith({ runId: "run-root" }),
    );

    clickButtonByText("Failed");
    expect(container.textContent).toContain("Security Agent");
    expect(container.querySelector(".row-list")?.textContent).not.toContain("Builder Agent");

    clickButtonByText("All Status");
    clickButtonByText("Blocking");
    expect(container.textContent).toContain("Builder Agent");
    expect(container.textContent).toContain("QA Agent");

    clickButtonByText("Steer");
    const steerInput = container.querySelector<HTMLTextAreaElement>(
      'textarea[aria-label="Steer instruction"]',
    );
    expect(steerInput).toBeTruthy();
    await act(async () => {
      fireEvent.change(steerInput as HTMLTextAreaElement, {
        target: { value: " keep going " },
      });
    });
    clickButtonByText("Send hint");
    await waitFor(() =>
      expect(apiMocks.steerSubagentRun).toHaveBeenCalledWith("run-root", "keep going"),
    );

    clickButtonByText("Kill run");
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain(
      "Terminate child session",
    );
    clickDialogButtonByText("Kill run");
    await waitFor(() => expect(apiMocks.killSubagentRun).toHaveBeenCalledWith("run-root"));
  });

  it("renders the subagents shell in Chinese", async () => {
    renderPanel("zh");

    await waitFor(() =>
      expect(apiMocks.fetchSubagentLineage).toHaveBeenCalledWith({ runId: "run-root" }),
    );

    expect(container.textContent).toContain("子智能体就绪");
    expect(container.textContent).toContain("运行记录");
    expect(container.textContent).toContain("每智能体权限");
    expect(container.textContent).toContain("谱系");
    expect(container.textContent).toContain("当前运行");
  });
});

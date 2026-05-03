// @vitest-environment jsdom
import { fireEvent, waitFor } from "@testing-library/react";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeckIntlProvider, type NextIntlClientProviderProps } from "../../../i18n/provider";
import { SubagentsPanel } from "./SubagentsPanel";

const apiMocks = vi.hoisted(() => ({
  applyDeckConfig: vi.fn(),
  fetchAgentsList: vi.fn(),
  fetchAgentSubagentConfig: vi.fn(),
  fetchDeckConfig: vi.fn(),
  fetchSubagentLineage: vi.fn(),
  fetchSubagentRuns: vi.fn(),
  killSubagentRun: vi.fn(),
  steerSubagentRun: vi.fn(),
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
    total: 2,
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
        spawnMode: "delegate",
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
        spawnMode: "delegate",
        depth: 1,
        createdAt: baseTime + 200,
        startedAt: baseTime + 300,
        endedAt: baseTime + 1200,
        durationMs: 900,
        status: "completed",
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
            archiveAfterMinutes: 45,
            maxChildrenPerAgent: 8,
            maxConcurrent: 4,
            maxSpawnDepth: 2,
            model: "openai/gpt-5.4",
            requireAgentId: true,
            runTimeoutSeconds: 120,
            thinking: "medium",
          },
        },
      },
    },
    hash: "cfg-h1",
    raw: JSON.stringify({
      agents: {
        defaults: {
          subagents: {
            archiveAfterMinutes: 45,
            maxChildrenPerAgent: 8,
            maxConcurrent: 4,
            maxSpawnDepth: 2,
            model: "openai/gpt-5.4",
            requireAgentId: true,
            runTimeoutSeconds: 120,
            thinking: "medium",
          },
        },
      },
    }),
  };
}

describe("SubagentsPanel", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    apiMocks.fetchAgentsList.mockResolvedValue({
      agents: [
        { id: "builder", name: "Builder Agent" },
        { id: "main", name: "Main Agent" },
        { id: "reviewer", name: "Reviewer Agent" },
      ],
    });
    apiMocks.fetchAgentSubagentConfig.mockImplementation(async (agentId: string) => ({
      agentId,
      allowAgents: agentId === "main" ? ["builder", "reviewer"] : [],
      allowAny: agentId === "builder",
      configHash: `${agentId}-hash`,
      effectiveMaxChildrenPerAgent: agentId === "main" ? 7 : 5,
      effectiveMaxSpawnDepth: agentId === "main" ? 2 : 1,
      model: agentId === "reviewer" ? "openai/gpt-5.4-mini" : undefined,
    }));
    apiMocks.fetchDeckConfig.mockResolvedValue(configSnapshot());
    apiMocks.applyDeckConfig.mockResolvedValue({ ok: true, hash: "cfg-h2" });
    apiMocks.fetchSubagentRuns.mockImplementation(
      async (params?: { status?: string; agentId?: string; requesterAgentId?: string }) => {
        let runs = subagentRuns().runs;
        if (params?.status && params.status !== "all") {
          runs = runs.filter((run) => run.status === params.status);
        }
        if (params?.agentId) {
          runs = runs.filter((run) => run.childAgentId === params.agentId);
        }
        if (params?.requesterAgentId) {
          runs = runs.filter((run) => run.requesterAgentId === params.requesterAgentId);
        }
        return {
          total: runs.length,
          runs,
        };
      },
    );
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

  it("loads active runs and renders lineage for the selected run", async () => {
    renderPanel();

    await waitFor(() =>
      expect(apiMocks.fetchSubagentLineage).toHaveBeenCalledWith({ runId: "run-root" }),
    );

    expect(apiMocks.fetchSubagentRuns).toHaveBeenCalledWith({
      limit: 100,
      status: "active",
    });
    expect(container.textContent).toContain("Subagents ready");
    expect(container.textContent).toContain("1 visible");
    expect(container.textContent).toContain("Builder Agent");
    expect(container.textContent).toContain("Reviewer Agent");

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Config")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Per-agent permissions");
    expect(container.textContent).toContain("Global spawn defaults");
    expect(container.textContent).toContain("Gateway-valid agents.defaults.subagents");
    expect(container.textContent).toContain("hash cfg-h1");
    expect(container.textContent).toContain("allowed: builder, reviewer");
    expect(container.textContent).toContain("allowed: Any");
    expect(container.textContent).toContain("openai/gpt-5.4-mini");
    expect(container.textContent).toContain("Lineage root");
    expect(container.textContent).toContain("agent:main:web-main");
    expect(container.textContent).toContain("Build feature");
    expect(container.textContent).toContain("Review feature");
    expect(container.querySelector('[data-testid="subagents-panel"]')).toBeTruthy();
    expect(container.querySelectorAll(".subagents-card")).toHaveLength(3);
    expect(container.querySelectorAll(".subagents-card__body")).toHaveLength(3);
    expect(container.querySelectorAll(".subagents-status-row").length).toBeGreaterThanOrEqual(1);
    expect(container.querySelector(".subagents-panel__metrics")).toBeTruthy();
    expect(container.querySelectorAll(".subagents-surface").length).toBeGreaterThanOrEqual(4);
    expect(container.querySelector(".subagents-defaults-grid")).toBeTruthy();
    expect(container.querySelector(".subagents-config-row")).toBeTruthy();
    expect(container.querySelectorAll(".ds-input").length).toBeGreaterThanOrEqual(7);
    expect(container.querySelectorAll(".subagents-inline-actions").length).toBeGreaterThanOrEqual(
      3,
    );
    expect(container.querySelectorAll(".ds-button").length).toBeGreaterThanOrEqual(10);
    expect(container.querySelector(".subagents-list")).toBeTruthy();
    expect(container.querySelectorAll(".subagents-permission-row").length).toBeGreaterThanOrEqual(
      3,
    );
    expect(container.querySelector(".subagents-hero")).toBeTruthy();
    expect(container.querySelector(".subagents-detail-grid")).toBeTruthy();
    expect(container.querySelector(".subagents-lineage-list")).toBeTruthy();

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Open agent subagents")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(deckUIMocks.navigateToAgent).toHaveBeenCalledWith(
      deckUIMocks.ui,
      "builder",
      "subagents",
    );

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Open child agent")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(deckUIMocks.navigateToAgent).toHaveBeenLastCalledWith(
      deckUIMocks.ui,
      "builder",
      "subagents",
    );

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Open requester agent")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(deckUIMocks.navigateToAgent).toHaveBeenLastCalledWith(
      deckUIMocks.ui,
      "main",
      "subagents",
    );

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Open child session")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(deckUIMocks.navigateToSession).toHaveBeenCalledWith(
      deckUIMocks.ui,
      "agent:builder:web-root",
    );

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Open requester session")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(deckUIMocks.navigateToSession).toHaveBeenLastCalledWith(
      deckUIMocks.ui,
      "agent:main:web-main",
    );
  });

  it("saves global subagent defaults through agents.defaults.subagents config", async () => {
    renderPanel();

    await waitFor(() => expect(apiMocks.fetchDeckConfig).toHaveBeenCalled());
    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Config")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const maxDepthInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="Global max spawn depth"]',
    );
    const modelInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="Global default model"]',
    );
    const requireAgentInput = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Global require explicit agent id"]',
    );
    expect(maxDepthInput).toBeTruthy();
    expect(modelInput).toBeTruthy();
    expect(requireAgentInput).toBeTruthy();

    await act(async () => {
      fireEvent.change(maxDepthInput as HTMLInputElement, { target: { value: "3" } });
      fireEvent.change(modelInput as HTMLInputElement, {
        target: { value: "anthropic/claude-sonnet-4.6" },
      });
      fireEvent.click(requireAgentInput as HTMLButtonElement);
    });

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Save defaults")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => expect(apiMocks.applyDeckConfig).toHaveBeenCalledTimes(1));
    const [raw, baseHash] = apiMocks.applyDeckConfig.mock.calls[0] as [string, string];
    const applied = JSON.parse(raw) as {
      agents?: {
        defaults?: {
          subagents?: {
            maxSpawnDepth?: number;
            model?: string;
            requireAgentId?: boolean;
          };
        };
      };
    };
    expect(applied.agents?.defaults?.subagents?.maxSpawnDepth).toBe(3);
    expect(applied.agents?.defaults?.subagents?.model).toBe("anthropic/claude-sonnet-4.6");
    expect(applied.agents?.defaults?.subagents?.requireAgentId).toBe(false);
    expect(baseHash).toBe("cfg-h1");
    expect(container.textContent).toContain("Subagent defaults save result");
  });

  it("refreshes filters and runs steer and kill actions for the selected run", async () => {
    renderPanel();

    await waitFor(() =>
      expect(apiMocks.fetchSubagentLineage).toHaveBeenCalledWith({ runId: "run-root" }),
    );

    const requesterInput = container.querySelector<HTMLInputElement>(
      'input[placeholder="requester agent id"]',
    );
    const statusSelect = container.querySelector<HTMLSelectElement>(
      'select[aria-label="Run status filter"]',
    );
    expect(requesterInput).toBeTruthy();
    expect(statusSelect).toBeTruthy();

    await act(async () => {
      fireEvent.change(requesterInput as HTMLInputElement, { target: { value: "main" } });
      fireEvent.change(statusSelect as HTMLSelectElement, { target: { value: "all" } });
    });
    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Refresh runs")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.fetchSubagentRuns).toHaveBeenLastCalledWith({
        limit: 100,
        requesterAgentId: "main",
        status: "all",
      }),
    );

    const instructionInput = container.querySelector<HTMLTextAreaElement>(
      'textarea[placeholder="instruction"]',
    );
    expect(instructionInput).toBeTruthy();

    await act(async () => {
      fireEvent.change(instructionInput as HTMLTextAreaElement, {
        target: { value: " keep going " },
      });
    });
    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Steer")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.steerSubagentRun).toHaveBeenCalledWith("run-root", "keep going"),
    );
    expect(container.textContent).toContain("Last subagent action");

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Kill run")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => expect(apiMocks.killSubagentRun).toHaveBeenCalledWith("run-root"));
    expect(window.confirm).toHaveBeenCalledWith("Kill subagent run run-root?");
  });

  it("does not kill a subagent run when kill confirmation is cancelled", async () => {
    vi.mocked(window.confirm).mockReturnValueOnce(false);

    renderPanel();

    await waitFor(() =>
      expect(apiMocks.fetchSubagentLineage).toHaveBeenCalledWith({ runId: "run-root" }),
    );

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Kill run")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(window.confirm).toHaveBeenCalledWith("Kill subagent run run-root?");
    expect(apiMocks.killSubagentRun).not.toHaveBeenCalled();
  });

  it("applies child-agent and status filters through the Gateway list query", async () => {
    renderPanel();

    await waitFor(() => expect(apiMocks.fetchAgentsList).toHaveBeenCalled());

    const childAgentSelect = container.querySelector<HTMLSelectElement>(
      'select[aria-label="Child agent filter"]',
    );
    const statusSelect = container.querySelector<HTMLSelectElement>(
      'select[aria-label="Run status filter"]',
    );
    expect(childAgentSelect).toBeTruthy();
    expect(statusSelect).toBeTruthy();

    await act(async () => {
      fireEvent.change(statusSelect as HTMLSelectElement, { target: { value: "all" } });
      fireEvent.change(childAgentSelect as HTMLSelectElement, { target: { value: "reviewer" } });
    });

    await waitFor(() =>
      expect(apiMocks.fetchSubagentRuns).toHaveBeenLastCalledWith({
        agentId: "reviewer",
        limit: 100,
        status: "all",
      }),
    );
    expect(container.textContent).toContain("Review feature");
    expect(container.textContent).toContain("Status: Completed");
    expect(container.textContent).toContain("Historical run detail");
    expect(container.textContent).toContain("agent:reviewer:web-child");
    expect(container.textContent).toContain("agent:builder:web-root");
    expect(container.textContent).toContain("gpt-5.4");
    expect(container.textContent).not.toContain("Status: Active | Depth: 0");
  });

  it("renders the subagents shell in Chinese", async () => {
    renderPanel("zh");

    await waitFor(() =>
      expect(apiMocks.fetchSubagentLineage).toHaveBeenCalledWith({ runId: "run-root" }),
    );

    expect(container.textContent).toContain("子智能体就绪");
    expect(container.textContent).toContain("活跃运行");
    expect(container.textContent).toContain("历史记录");
    expect(container.textContent).toContain("配置");
    expect(container.textContent).toContain("运行过滤");
    expect(container.textContent).toContain("运行详情");
    expect(container.textContent).toContain("谱系根节点");
  });
});

// @vitest-environment jsdom
import { fireEvent, waitFor } from "@testing-library/react";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearTranscriptCache,
  getCachedTranscript,
  setCachedTranscript,
} from "@/lib/transcript-cache";
import { DataFabricTestProvider } from "../../../data/testing/DataFabricTestProvider";
import { DeckIntlProvider } from "../../../i18n/provider";
import { SessionsPanel } from "./SessionsPanel";

const apiMocks = vi.hoisted(() => ({
  branchCompactionCheckpoint: vi.fn(),
  clearSession: vi.fn(),
  compactChatSession: vi.fn(),
  deleteSession: vi.fn(),
  fetchCompactionCheckpoints: vi.fn(),
  fetchChatHistory: vi.fn(),
  fetchSessionDetail: vi.fn(),
  fetchSessionPreviews: vi.fn(),
  fetchSessions: vi.fn(),
  fetchSubagentLineage: vi.fn(),
  fetchUsageSessionLogs: vi.fn(),
  fetchUsageSessions: vi.fn(),
  patchSession: vi.fn(),
  resetSession: vi.fn(),
  restoreCompactionCheckpoint: vi.fn(),
}));

const deckUIMocks = vi.hoisted(() => ({
  navigateToPanel: vi.fn(),
  ui: { setActivePanel: vi.fn() },
}));

vi.mock("@/api", () => apiMocks);
vi.mock("../../../api", () => apiMocks);
vi.mock("../../../deck-ui/panel-navigation", () => ({
  navigateToPanel: deckUIMocks.navigateToPanel,
}));
vi.mock("../../../deck-ui/ui-store", () => ({
  useDeckUI: () => deckUIMocks.ui,
}));

let container: HTMLDivElement;
let root: Root | null = null;

const baseTime = Date.UTC(2026, 3, 24, 10, 0, 0);

function sessionsPayload() {
  return {
    sessions: [
      {
        key: "sess-main",
        kind: "direct",
        agentId: "main",
        label: "Main Label",
        title: "Main Session",
        updatedAt: baseTime,
        lastMessagePreview: "hello from main",
        status: "idle",
        runtimeMs: 123,
        model: "gpt-5.4",
        modelProvider: "openai",
        thinkingLevel: "low",
        fastMode: true,
        inputTokens: 120,
        outputTokens: 80,
        totalTokens: 200,
        totalTokensFresh: true,
        contextTokens: 1000,
        estimatedCostUsd: 0.25,
        compactionCount: 2,
      },
      {
        key: "sess-build",
        kind: "subagent",
        agentId: "builder",
        title: "Builder Session",
        updatedAt: baseTime - 1_000,
        lastMessagePreview: "build preview",
        status: "running",
        runtimeMs: 456,
        model: "sonnet-4.6",
        modelProvider: "anthropic",
        parentSessionKey: "sess-main",
        childSessions: ["sess-child"],
        subagentRole: "leaf",
        subagentControlScope: "children",
        spawnedWorkspaceDir: "/tmp/openclaw-subagent",
      },
    ],
  };
}

function sessionFor(key: string) {
  return (
    sessionsPayload().sessions.find((session) => session.key === key) ?? {
      key,
      agentId: "unknown",
      title: key,
    }
  );
}

function sessionDetail(key: string) {
  return {
    session: sessionFor(key),
    messages: [
      {
        id: `detail-${key}`,
        role: "assistant",
        content: [{ type: "text", text: `detail ${key}` }],
      },
    ],
  };
}

function chatHistory(key: string) {
  return {
    messages: [
      {
        id: `history-${key}`,
        role: "user",
        content: [{ type: "text", text: `history ${key}` }],
      },
    ],
  };
}

function sessionPreviews() {
  return {
    previews: [
      {
        key: "sess-main",
        status: "ok",
        items: [{ role: "assistant", text: "main preview" }],
      },
      {
        key: "sess-build",
        status: "ok",
        items: [{ role: "user", text: "builder preview" }],
      },
    ],
  };
}

function lineagePayload(sessionKey = "sess-build") {
  return {
    root: {
      sessionKey,
      agentId: "builder",
      agentName: "Builder",
    },
    nodes: [
      {
        runId: "run-child",
        sessionKey: "sess-child",
        agentId: "reviewer",
        agentName: "Reviewer",
        task: "review migrated session logic",
        depth: 1,
        parentRunId: "run-root",
        status: "running",
      },
    ],
  };
}

function contextWeightPayload() {
  return {
    source: "gateway",
    generatedAt: baseTime,
    systemPrompt: {
      chars: 2400,
      projectContextChars: 900,
      customRulesChars: 200,
      agentPromptChars: 1300,
    },
    tools: {
      listChars: 800,
      schemaChars: 1200,
      entries: [{ name: "search", summaryChars: 120, schemaChars: 240 }],
    },
    skills: {
      promptChars: 500,
      entries: [{ name: "sessions", blockChars: 500 }],
    },
    injectedWorkspaceFiles: [
      {
        name: "README.md",
        path: "README.md",
        injectedChars: 600,
        truncated: false,
      },
    ],
  };
}

function usageSessionsPayload(key = "sess-main") {
  return {
    sessions: [
      {
        key,
        label: key === "sess-main" ? "Main Session" : key,
        usage: {
          input: 100,
          output: 50,
          totalTokens: 150,
          totalCost: 1.25,
        },
        contextWeight: contextWeightPayload(),
      },
    ],
  };
}

function usageSessionsPartialContextWeightPayload(key = "sess-main") {
  return {
    sessions: [
      {
        key,
        label: key,
        usage: {
          totalTokens: 3,
          totalCost: 0.01,
        },
        contextWeight: {
          source: "gateway",
          generatedAt: baseTime,
          systemPrompt: {
            chars: 3,
          },
          tools: {
            listChars: 1,
          },
          skills: {
            promptChars: 2,
          },
        },
      },
    ],
  };
}

function usageSessionLogsPayload() {
  return {
    logs: [
      {
        timestamp: baseTime,
        role: "user",
        content: "usage log detail",
        tokens: 12,
        cost: 0.01,
      },
      {
        timestamp: baseTime + 1_000,
        role: "assistant",
        content: "small turn",
        tokens: 10,
        cost: 0.01,
      },
      {
        timestamp: baseTime + 2_000,
        role: "assistant",
        content: "large turn",
        tokens: 80,
        cost: 0.03,
      },
    ],
  };
}

function compactionCheckpointsPayload() {
  return {
    ok: true,
    key: "sess-main",
    checkpoints: [
      {
        checkpointId: "cp-1",
        sessionKey: "sess-main",
        sessionId: "sid-main",
        createdAt: baseTime,
        reason: "manual",
        tokensBefore: 5000,
        tokensAfter: 2000,
        summary: "compressed older turns",
      },
    ],
  };
}

function renderSessionsPanel() {
  root = createRoot(container);
  root.render(
    createElement(
      DataFabricTestProvider,
      null,
      createElement(DeckIntlProvider, { locale: "en" }, createElement(SessionsPanel)),
    ),
  );
}

function buttonByExactText(text: string) {
  const button = Array.from(container.querySelectorAll("button")).find(
    (candidate) => candidate.textContent === text,
  );
  expect(button).toBeTruthy();
  return button as HTMLButtonElement;
}

describe("SessionsPanel", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    window.history.replaceState({}, "", "/");
    container = document.createElement("div");
    document.body.appendChild(container);
    clearTranscriptCache();
    apiMocks.fetchSessions.mockResolvedValue(sessionsPayload());
    apiMocks.fetchSessionPreviews.mockResolvedValue(sessionPreviews());
    apiMocks.fetchSessionDetail.mockImplementation(async ({ sessionKey }: { sessionKey: string }) =>
      sessionDetail(sessionKey),
    );
    apiMocks.fetchChatHistory.mockImplementation(async ({ sessionKey }: { sessionKey: string }) =>
      chatHistory(sessionKey),
    );
    apiMocks.fetchSubagentLineage.mockImplementation(
      async ({ sessionKey }: { sessionKey?: string }) => lineagePayload(sessionKey),
    );
    apiMocks.fetchUsageSessions.mockImplementation(async ({ key }: { key?: string }) =>
      usageSessionsPayload(key),
    );
    apiMocks.fetchUsageSessionLogs.mockResolvedValue(usageSessionLogsPayload());
    apiMocks.fetchCompactionCheckpoints.mockResolvedValue(compactionCheckpointsPayload());
    apiMocks.branchCompactionCheckpoint.mockResolvedValue({ ok: true, key: "sess-main-branch" });
    apiMocks.restoreCompactionCheckpoint.mockResolvedValue({ ok: true, key: "sess-main" });
    apiMocks.patchSession.mockResolvedValue({
      ok: true,
      key: "sess-main",
      entry: { model: "cpa/gpt-5.5" },
    });
    apiMocks.resetSession.mockResolvedValue({ ok: true, key: "sess-main", reason: "reset" });
    apiMocks.clearSession.mockResolvedValue({ ok: true, key: "sess-main" });
    apiMocks.compactChatSession.mockResolvedValue({ ok: true, status: 202 });
    apiMocks.deleteSession.mockResolvedValue({ ok: true, key: "sess-main", action: "delete" });
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    root = null;
    container.remove();
    window.history.replaceState({}, "", "/");
    clearTranscriptCache();
    vi.clearAllMocks();
  });

  it("loads session inventory, previews, detail, and history for the selected session", async () => {
    await act(async () => {
      renderSessionsPanel();
    });

    await waitFor(() =>
      expect(apiMocks.fetchSessionDetail).toHaveBeenCalledWith({ sessionKey: "sess-main" }),
    );

    expect(apiMocks.fetchSessions).toHaveBeenCalledTimes(1);
    expect(apiMocks.fetchSessionPreviews).toHaveBeenCalledWith(["sess-main", "sess-build"]);
    expect(apiMocks.fetchChatHistory).toHaveBeenCalledWith({
      sessionKey: "sess-main",
      limit: 80,
    });
    expect(container.textContent).toContain("Inventory ready");
    expect(container.textContent).toContain("Detail ready");
    expect(container.querySelector(".sessions-panel")).not.toBeNull();
    expect(container.querySelectorAll(".sessions-card").length).toBeGreaterThanOrEqual(3);
    expect(container.querySelectorAll(".sessions-surface").length).toBeGreaterThanOrEqual(5);
    expect(container.querySelectorAll(".sessions-input").length).toBeGreaterThanOrEqual(4);
    expect(container.querySelector(".sessions-inventory-list")).not.toBeNull();
    expect(container.querySelector(".sessions-hero")).not.toBeNull();
    expect(container.textContent).toContain("2 visible");
    expect(container.textContent).toContain("Main Session");
    expect(container.textContent).toContain("hello from main");
    expect(container.textContent).toContain("history sess-main");
    expect(container.textContent).toContain("main preview");
    expect(container.textContent).toContain("Runtime metadata");
    expect(container.textContent).toContain("context 20%");
    expect(container.textContent).toContain("thinking: low | fast mode: on");
    expect(getCachedTranscript("sess-main")).toMatchObject([
      {
        role: "user",
        content: [{ type: "text", text: "history sess-main" }],
      },
    ]);

    const searchInput = container.querySelector<HTMLInputElement>(
      'input[placeholder="title, key, preview"]',
    );
    expect(searchInput).toBeTruthy();

    await act(async () => {
      fireEvent.change(searchInput as HTMLInputElement, { target: { value: "build" } });
    });

    expect(container.textContent).toContain("1 visible");
    expect(container.textContent).toContain("Builder Session");

    const builderButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Builder Session"),
    );
    expect(builderButton).toBeTruthy();

    await act(async () => {
      builderButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.fetchSessionDetail).toHaveBeenCalledWith({ sessionKey: "sess-build" }),
    );
    expect(apiMocks.fetchChatHistory).toHaveBeenCalledWith({
      sessionKey: "sess-build",
      limit: 80,
    });
    expect(container.textContent).toContain("history sess-build");
  });

  it("preserves cached session inventory when manual refresh fails", async () => {
    await act(async () => {
      renderSessionsPanel();
    });

    await waitFor(() =>
      expect(apiMocks.fetchSessionDetail).toHaveBeenCalledWith({ sessionKey: "sess-main" }),
    );

    apiMocks.fetchSessions.mockRejectedValueOnce(new Error("sessions inventory down"));

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Refresh sessions")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => expect(container.textContent).toContain("sessions inventory down"));
    expect(container.textContent).toContain("Main Session");
    expect(container.textContent).toContain("Builder Session");
  });

  it("selects the session requested by cross-panel navigation params", async () => {
    window.history.replaceState({}, "", "/?surface=deck-ui&panel=sessions&sessionKey=sess-build");

    await act(async () => {
      renderSessionsPanel();
    });

    await waitFor(() =>
      expect(apiMocks.fetchSessionDetail).toHaveBeenCalledWith({ sessionKey: "sess-build" }),
    );

    const selectedButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.className.includes("is-selected"),
    );
    expect(selectedButton?.textContent).toContain("Builder Session");
    expect(container.textContent).toContain("history sess-build");
  });

  it("loads selected session usage, context weight, and usage-log timeline", async () => {
    await act(async () => {
      renderSessionsPanel();
    });

    await waitFor(() =>
      expect(apiMocks.fetchUsageSessions).toHaveBeenCalledWith({
        includeContextWeight: true,
        key: "sess-main",
        limit: 1,
      }),
    );
    expect(apiMocks.fetchUsageSessionLogs).toHaveBeenCalledWith({
      key: "sess-main",
      limit: 50,
    });
    expect(container.textContent).toContain("Usage and context");
    expect(container.textContent).toContain("usage ready");
    expect(container.textContent).toContain("150");
    expect(container.textContent).toContain("$1.2500");
    expect(container.textContent).toContain("context total");
    expect(container.textContent).toContain("5.5K");
    expect(container.textContent).toContain("system prompt");
    expect(container.textContent).toContain("tools");
    expect(container.textContent).toContain("Session turn timeline");
    expect(container.textContent).toContain("usage log detail");
    expect(container.textContent).toContain("high token turn");
  });

  it("renders partial real context-weight payloads without nested entries", async () => {
    apiMocks.fetchUsageSessions.mockImplementation(async ({ key }: { key?: string }) =>
      usageSessionsPartialContextWeightPayload(key),
    );

    await act(async () => {
      renderSessionsPanel();
    });

    await waitFor(() =>
      expect(apiMocks.fetchUsageSessions).toHaveBeenCalledWith({
        includeContextWeight: true,
        key: "sess-main",
        limit: 1,
      }),
    );
    expect(container.textContent).toContain("context total");
    expect(container.textContent).toContain("6");
    expect(container.textContent).toContain("1 chars | 0 entries");
    expect(container.textContent).toContain("2 chars | 0 entries");
  });

  it("loads compaction checkpoints and runs branch or restore actions", async () => {
    await act(async () => {
      renderSessionsPanel();
    });

    await waitFor(() =>
      expect(apiMocks.fetchCompactionCheckpoints).toHaveBeenCalledWith("sess-main"),
    );
    expect(container.textContent).toContain("Compaction checkpoints");
    expect(container.textContent).toContain("manual");
    expect(container.textContent).toContain("saved 3.0K tokens");
    expect(container.textContent).toContain("compressed older turns");

    await act(async () => {
      buttonByExactText("Branch cp-1").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.branchCompactionCheckpoint).toHaveBeenCalledWith("sess-main", "cp-1"),
    );
    expect(container.textContent).toContain("Last compaction action: branch sess-main-branch");

    await act(async () => {
      buttonByExactText("Restore cp-1").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(apiMocks.restoreCompactionCheckpoint).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Confirm restore");

    await act(async () => {
      buttonByExactText("Confirm restore").dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    await waitFor(() =>
      expect(apiMocks.restoreCompactionCheckpoint).toHaveBeenCalledWith("sess-main", "cp-1"),
    );
    expect(container.textContent).toContain("Last compaction action: restore cp-1");
  });

  it("switches Inspector tabs without changing the selected session", async () => {
    await act(async () => {
      renderSessionsPanel();
    });

    await waitFor(() =>
      expect(apiMocks.fetchSessionDetail).toHaveBeenCalledWith({ sessionKey: "sess-main" }),
    );
    expect(document.getElementById("sessions-inspector-overview")?.hidden).toBe(false);
    expect(document.getElementById("sessions-inspector-usage")?.hidden).toBe(true);

    await act(async () => {
      buttonByExactText("Usage").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(document.getElementById("sessions-inspector-overview")?.hidden).toBe(true);
    expect(document.getElementById("sessions-inspector-usage")?.hidden).toBe(false);
    expect(container.textContent).toContain("sess-main");
    expect(apiMocks.fetchSessionDetail).toHaveBeenCalledWith({ sessionKey: "sess-main" });
  });

  it("loads subagent lineage and preserves parent/child session navigation", async () => {
    await act(async () => {
      renderSessionsPanel();
    });

    await waitFor(() =>
      expect(apiMocks.fetchSessionDetail).toHaveBeenCalledWith({ sessionKey: "sess-main" }),
    );

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent?.includes("Builder Session"))
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.fetchSubagentLineage).toHaveBeenCalledWith({ sessionKey: "sess-build" }),
    );
    expect(container.textContent).toContain("Subagent lineage");
    expect(container.textContent).toContain("root: sess-build");
    expect(container.textContent).toContain("run: run-child");
    expect(container.textContent).toContain("review migrated session logic");
    expect(container.textContent).toContain("role leaf");
    expect(container.textContent).toContain("control children");
    expect(container.textContent).toContain("Parent sess-main");
    expect(container.textContent).toContain("Child sess-child");

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Open subagents panel")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(deckUIMocks.navigateToPanel).toHaveBeenCalledWith(deckUIMocks.ui, "subagents");

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Child sess-child")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.fetchSessionDetail).toHaveBeenCalledWith({ sessionKey: "sess-child" }),
    );
    expect(apiMocks.fetchChatHistory).toHaveBeenCalledWith({
      sessionKey: "sess-child",
      limit: 80,
    });
  });

  it("applies session inventory search, active window, and type filters", async () => {
    await act(async () => {
      renderSessionsPanel();
    });

    await waitFor(() =>
      expect(apiMocks.fetchSessionDetail).toHaveBeenCalledWith({ sessionKey: "sess-main" }),
    );
    expect(apiMocks.fetchSessions).toHaveBeenCalledWith({ limit: 200 });

    const searchInput = container.querySelector<HTMLInputElement>(
      'input[placeholder="title, key, preview"]',
    );
    const activeSelect = container.querySelector<HTMLSelectElement>(
      'select[aria-label="Active minutes filter"]',
    );
    const typeSelect = container.querySelector<HTMLSelectElement>(
      'select[aria-label="Session type filter"]',
    );
    expect(searchInput).toBeTruthy();
    expect(activeSelect).toBeTruthy();
    expect(typeSelect).toBeTruthy();

    await act(async () => {
      fireEvent.change(searchInput as HTMLInputElement, { target: { value: "build" } });
      fireEvent.change(activeSelect as HTMLSelectElement, { target: { value: "60" } });
    });

    await waitFor(() =>
      expect(apiMocks.fetchSessions).toHaveBeenLastCalledWith({
        activeMinutes: 60,
        limit: 200,
        search: "build",
      }),
    );
    expect(container.textContent).toContain("1 visible");
    expect(container.textContent).toContain("Builder Session");

    await act(async () => {
      fireEvent.change(typeSelect as HTMLSelectElement, { target: { value: "direct" } });
    });

    expect(container.textContent).toContain("0 visible");
    expect(container.textContent).not.toContain("Builder Session");
  });

  it("searches loaded transcript history and prepares JSON/Markdown exports", async () => {
    await act(async () => {
      renderSessionsPanel();
    });

    await waitFor(() =>
      expect(apiMocks.fetchSessionDetail).toHaveBeenCalledWith({ sessionKey: "sess-main" }),
    );

    const transcriptSearchInput = container.querySelector<HTMLInputElement>(
      'input[placeholder="search transcript"]',
    );
    expect(transcriptSearchInput).toBeTruthy();

    await act(async () => {
      fireEvent.change(transcriptSearchInput as HTMLInputElement, {
        target: { value: "history" },
      });
    });

    expect(container.textContent).toContain("match 1 of 1");
    expect(container.textContent).toContain("history sess-main");

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Export JSON")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Prepared json export");
    expect(container.textContent).toContain('"key": "sess-main"');
    expect(container.textContent).toContain('"id": "history-sess-main"');

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Export Markdown")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Prepared markdown export");
    expect(container.textContent).toContain("# Session: Main Session");
    expect(container.textContent).toContain("history sess-main");
  });

  it("uses the shared transcript cache for selected session history", async () => {
    setCachedTranscript("sess-main", [
      {
        id: "cached-main",
        role: "assistant",
        content: [{ type: "text", text: "cached main history" }],
        timestamp: baseTime,
      },
    ]);

    await act(async () => {
      renderSessionsPanel();
    });

    await waitFor(() =>
      expect(apiMocks.fetchSessionDetail).toHaveBeenCalledWith({ sessionKey: "sess-main" }),
    );

    expect(apiMocks.fetchChatHistory).not.toHaveBeenCalled();
    expect(container.textContent).toContain("cached main history");
  });

  it("runs reset, clear, and model patch actions through deck-go session APIs", async () => {
    await act(async () => {
      renderSessionsPanel();
    });

    await waitFor(() =>
      expect(apiMocks.fetchSessionDetail).toHaveBeenCalledWith({ sessionKey: "sess-main" }),
    );

    const modelInput = container.querySelector<HTMLInputElement>(
      'input[placeholder="cpa/gpt-5.4"]',
    );
    const labelInput = container.querySelector<HTMLInputElement>(
      'input[placeholder="session label"]',
    );
    const thinkingSelect = container.querySelector<HTMLSelectElement>(
      'select[aria-label="Session thinking level"]',
    );
    const fastModeToggle = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Session fast mode"]',
    );
    expect(modelInput).toBeTruthy();
    expect(labelInput).toBeTruthy();
    expect(thinkingSelect).toBeTruthy();
    expect(fastModeToggle).toBeTruthy();
    expect(labelInput?.value).toBe("Main Label");
    expect(thinkingSelect?.value).toBe("low");
    expect(fastModeToggle?.getAttribute("aria-checked")).toBe("true");

    await act(async () => {
      fireEvent.change(modelInput as HTMLInputElement, { target: { value: " cpa/gpt-5.5 " } });
    });
    await act(async () => {
      buttonByExactText("Patch model").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.patchSession).toHaveBeenCalledWith({
        sessionKey: "sess-main",
        model: "cpa/gpt-5.5",
      }),
    );
    expect(container.textContent).toContain("Latest action");

    await act(async () => {
      fireEvent.change(labelInput as HTMLInputElement, { target: { value: " Updated Label " } });
      fireEvent.change(thinkingSelect as HTMLSelectElement, { target: { value: "high" } });
      fireEvent.click(fastModeToggle as HTMLButtonElement);
    });
    await act(async () => {
      buttonByExactText("Patch directives").dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    await waitFor(() =>
      expect(apiMocks.patchSession).toHaveBeenCalledWith({
        sessionKey: "sess-main",
        label: "Updated Label",
        thinkingLevel: "high",
        fastMode: false,
      }),
    );

    await act(async () => {
      buttonByExactText("Reset session").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(apiMocks.resetSession).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Confirm reset");

    await act(async () => {
      buttonByExactText("Confirm reset").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.resetSession).toHaveBeenCalledWith({
        sessionKey: "sess-main",
        reason: "reset",
      }),
    );

    await act(async () => {
      buttonByExactText("Clear session").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(apiMocks.clearSession).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Confirm clear");

    await act(async () => {
      buttonByExactText("Confirm clear").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.clearSession).toHaveBeenCalledWith({ sessionKey: "sess-main" }),
    );
  });

  it("requires confirmation before compacting a selected session", async () => {
    await act(async () => {
      renderSessionsPanel();
    });

    await waitFor(() =>
      expect(apiMocks.fetchSessionDetail).toHaveBeenCalledWith({ sessionKey: "sess-main" }),
    );

    const compactButton = () => buttonByExactText("Compact session");

    await act(async () => {
      compactButton().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(apiMocks.compactChatSession).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Confirm compact");

    await act(async () => {
      buttonByExactText("Confirm compact").dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    await waitFor(() => expect(apiMocks.compactChatSession).toHaveBeenCalledWith("sess-main"));
    expect(container.textContent).toContain("Latest action");
    expect(container.textContent).toContain('"action": "compact"');
  });

  it("requires confirmation before deleting and selects the next available session", async () => {
    const remainingSessions = { sessions: [sessionsPayload().sessions[1]] };
    apiMocks.fetchSessions
      .mockResolvedValueOnce(sessionsPayload())
      .mockResolvedValueOnce(remainingSessions)
      .mockResolvedValue(remainingSessions);

    await act(async () => {
      renderSessionsPanel();
    });

    await waitFor(() =>
      expect(apiMocks.fetchSessionDetail).toHaveBeenCalledWith({ sessionKey: "sess-main" }),
    );

    const deleteButton = () => buttonByExactText("Delete session");

    await act(async () => {
      deleteButton().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(apiMocks.deleteSession).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Confirm delete");

    await act(async () => {
      buttonByExactText("Confirm delete").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.deleteSession).toHaveBeenCalledWith({
        sessionKey: "sess-main",
        agentId: "main",
      }),
    );
    await waitFor(() =>
      expect(apiMocks.fetchSessionDetail).toHaveBeenCalledWith({ sessionKey: "sess-build" }),
    );
  });

  it("removes history and lineage badges from selected hero", async () => {
    await act(async () => {
      renderSessionsPanel();
    });
    await waitFor(() =>
      expect(apiMocks.fetchSessionDetail).toHaveBeenCalledWith({ sessionKey: "sess-main" }),
    );
    const hero = container.querySelector(".sessions-hero");
    expect(hero).not.toBeNull();
    const statusRowText = hero!.querySelector(".sessions-status-row")?.textContent ?? "";
    expect(statusRowText).not.toMatch(/history/i);
    expect(statusRowText).not.toMatch(/lineage/i);
  });
});

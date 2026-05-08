// @vitest-environment jsdom
import { NextIntlClientProvider } from "next-intl";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DataFabricTestProvider } from "@/data/testing/DataFabricTestProvider";
import {
  clearTranscriptCache,
  getCachedTranscript,
  setCachedTranscript,
} from "@/lib/transcript-cache";
import { useApprovalsStore } from "@/stores/approvals";
import { useChatStore } from "@/stores/chat";
import { useSessionsStore } from "@/stores/sessions";
import { ChatPanel } from "../ChatPanel";

const chatApi = vi.hoisted(() => ({
  abortChatRun: vi.fn(),
  clearChatSession: vi.fn(),
  compactChatSession: vi.fn(),
  createChatSession: vi.fn(),
  fetchChatSnapshot: vi.fn(),
  fetchSessionList: vi.fn(),
  fetchSessionPreviews: vi.fn(),
  patchChatSession: vi.fn(),
  patchSession: vi.fn(),
  persistChatProjection: vi.fn(),
  resetChatSession: vi.fn(),
  resolveCanvasEval: vi.fn(),
  sendChatMessage: vi.fn(),
  setCanvasBridgeReady: vi.fn(),
  setSessionMessageSubscription: vi.fn(),
  steerChatSession: vi.fn(),
}));

const deckApi = vi.hoisted(() => ({
  fetchChatSnapshot: vi.fn(),
  fetchCommandDiscovery: vi.fn(),
  fetchSessionPreviews: vi.fn(),
  fetchSessions: vi.fn(),
  setSessionEventsSubscription: vi.fn(),
}));

const commandDiscovery = vi.hoisted(() => ({
  useCommandDiscovery: vi.fn(),
}));

vi.mock("@/api", () => deckApi);
vi.mock("../chat-api", async () => {
  const actual = await vi.importActual<typeof import("../chat-api")>("../chat-api");
  return { ...actual, ...chatApi };
});
vi.mock("@/hooks/use-command-discovery", () => commandDiscovery);

const messages = {
  chat: {
    abort: "Stop",
    artifactToggle: "Artifact panel",
    artifactClose: "Close artifact",
    canvasCollapse: "Collapse canvas",
    canvasEmpty: "No canvas content",
    canvasError: "Canvas failed to load",
    canvasLoading: "Loading canvas...",
    canvasRetry: "Retry canvas",
    canvasTitle: "Canvas",
    canvasToggle: "Canvas panel",
    configFast: "Fast",
    configFastToggle: "Toggle fast",
    configModel: "Model",
    configModelDefault: "Default",
    configOff: "Off",
    configOn: "On",
    configThinking: "Thinking",
    configThinkingToggle: "Toggle thinking",
    configVerbose: "Verbose",
    copied: "Copied",
    copy: "Copy",
    copyJson: "Copy JSON",
    defaultAgent: "Default agent",
    debugTitle: "Debug",
    emptyDescription: "Select a session or send a message.",
    emptyTitle: "No session selected",
    error: "Error",
    filterBlocks: "Block filters",
    filterResults: "Results",
    filterThinking: "Thinking",
    filterTools: "Tools",
    messageActions: "Message actions",
    newSession: "New session",
    noMessages: "No messages",
    openArtifact: "Open Artifact",
    partialResult: "Partial result",
    placeholder: "Type a message...",
    retry: "Retry",
    searchSessions: "Search sessions...",
    searchTranscript: "Search messages...",
    searchPrev: "Previous",
    searchNext: "Next",
    searchClear: "Clear",
    send: "Send",
    showFormatted: "Show formatted",
    showRaw: "Show raw",
    sseDisconnected: "SSE disconnected",
    sseReconnecting: "SSE reconnecting",
    steer: "Steer",
    steerPlaceholder: "Steer active session...",
    steerQuickAccess: "Go to steer",
    suggestAnalyze: "Analyze this",
    suggestCreative: "Create something",
    suggestExplain: "Explain this",
    thinking: "Thinking...",
    thumbsDown: "Thumbs down",
    thumbsUp: "Thumbs up",
    toolCall: "Tool call",
    toolError: "Tool error",
    toolResult: "Tool result",
    tools: "Tools",
    toolsCompleted: "Tools completed",
    toolsRunning: "{count} tools running",
    noSearchResults: "No matches found",
    contextLabel: "Context",
    contextCompacted: "Compacted {count} times",
    contextWarning: "Context window nearly full",
  },
  sessions: {
    compact: "Compact",
    compacting: "Compacting",
    compactFailed: "Compaction failed: {reason}",
  },
  approvals: {
    inlineTitle: "Approval required",
    pendingBadge: "pending",
    agent: "Agent",
    approve: "Approve",
    approveAlways: "Always approve",
    deny: "Deny",
  },
};

let container: HTMLDivElement;
let root: Root | null = null;

function resetChatStore() {
  useChatStore.setState({
    sessions: new Map(),
    sessionMetas: [],
    sessionMeta: [],
    sessionPreviewOverlays: {},
    activeSessionKey: null,
    activeAgentId: "main",
    sseStatus: "idle",
    canvasCommands: [],
  });
  useSessionsStore.setState({
    sessions: [],
  });
  useApprovalsStore.setState({
    pending: [],
    policy: null,
    policyHash: null,
    loading: false,
    error: null,
  });
}

function renderPanel() {
  act(() => {
    root = createRoot(container);
    root.render(
      createElement(
        DataFabricTestProvider,
        {
          gatewayRpc: async () => ({
            agents: [
              { id: "main", name: "Main Agent", status: "idle" },
              { id: "ops", name: "Ops Bot", status: "idle" },
            ],
          }),
        },
        createElement(NextIntlClientProvider, { locale: "en", messages }, createElement(ChatPanel)),
      ),
    );
  });
}

function unmountPanel() {
  if (!root) {
    return;
  }
  act(() => {
    root?.unmount();
  });
  root = null;
}

describe("ChatPanel active entry", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    window.localStorage.clear();
    window.history.replaceState(null, "", "/");
    clearTranscriptCache();
    resetChatStore();
    vi.clearAllMocks();
    deckApi.fetchSessions.mockResolvedValue({ sessions: [] });
    deckApi.fetchSessionPreviews.mockResolvedValue({});
    deckApi.fetchChatSnapshot.mockResolvedValue({
      activeApproval: null,
      a2uiState: null,
      messages: [],
      session: null,
    });
    deckApi.setSessionEventsSubscription.mockImplementation(
      async (body: { action: "subscribe" | "unsubscribe"; sessionKey: string }) => ({
        ...body,
        ok: true,
      }),
    );
    chatApi.patchSession.mockResolvedValue(true);
    chatApi.createChatSession.mockResolvedValue({ key: "sess-created" });
    chatApi.sendChatMessage.mockResolvedValue({ status: "started" });
    chatApi.abortChatRun.mockResolvedValue({ ok: true });
    chatApi.steerChatSession.mockResolvedValue({ ok: true });
    chatApi.persistChatProjection.mockResolvedValue(undefined);
    chatApi.resolveCanvasEval.mockResolvedValue(undefined);
    chatApi.setCanvasBridgeReady.mockResolvedValue(undefined);
    chatApi.setSessionMessageSubscription.mockResolvedValue(undefined);
  });

  afterEach(() => {
    unmountPanel();
    clearTranscriptCache();
    window.history.replaceState(null, "", "/");
    container.remove();
  });

  it("seeds deterministic rich visual state behind the dev/test URL flag", async () => {
    deckApi.fetchSessions.mockRejectedValue(new Error("visual seed skips API"));
    deckApi.fetchChatSnapshot.mockRejectedValue(new Error("visual seed skips snapshot"));
    window.history.replaceState(null, "", "/?deckVisualState=chat-rich");

    renderPanel();

    await vi.waitFor(() => {
      expect(useChatStore.getState().activeSessionKey).toBe("visual-main");
    });

    const session = useChatStore.getState().sessions.get("visual-main");
    expect(session?.messages.map((message) => message.id)).toContain("visual-assistant-streaming");
    expect(session?.isStreaming).toBe(true);
    expect(session?.activeApproval?.id).toBe("visual-approval-1");
    expect(session?.a2uiState).toMatchObject({ visible: true, surfaces: ["canvas", "artifact"] });
    expect(useApprovalsStore.getState().pending.map((approval) => approval.id)).toEqual([
      "visual-approval-1",
    ]);
    expect(container.textContent).toContain("Gateway startup regression triage");
    expect(container.textContent).toContain(
      "Visual seed: streaming response with approval and canvas drawer.",
    );
    expect(container.textContent).toContain("Approval required");
    expect(container.textContent).toContain("shell_command");
    // Chat-parity §5: ChatContextBar collapsed into bundle's 5-cell layout —
    // the "Context window nearly full" string now only appears in the
    // composer's ctx-warn (gated at pct >= 95). Visual-rich seed sits below
    // that threshold, so we no longer assert the warning here.
    expect(container.textContent).toContain("Canvas");
  });

  it("hydrates the first Gateway session through the migrated store path", async () => {
    deckApi.fetchSessions.mockResolvedValue({
      sessions: [
        {
          key: "sess-1",
          agentId: "main",
          title: "Primary Session",
          updatedAt: 10,
          status: "done",
          model: "gpt-5.4",
        },
      ],
    });
    deckApi.fetchChatSnapshot.mockResolvedValue({
      messages: [
        {
          id: "msg-1",
          role: "assistant",
          content: [{ type: "text", text: "Hydrated from snapshot" }],
          timestamp: 20,
        },
      ],
      session: {
        key: "sess-1",
        agentId: "main",
        title: "Primary Session",
        updatedAt: 30,
        status: "done",
        model: "gpt-5.4",
        totalTokens: 850,
        contextTokens: 1000,
        compactionCount: 2,
      },
      activeApproval: null,
      a2uiState: { visible: true, surfaces: ["summary"] },
    });

    renderPanel();

    await vi.waitFor(() => {
      expect(deckApi.fetchSessions).toHaveBeenCalledWith({ agentId: "main" });
    });
    await vi.waitFor(() => {
      expect(deckApi.fetchChatSnapshot).toHaveBeenCalledWith({
        sessionKey: "sess-1",
        agentId: "main",
      });
    });

    expect(commandDiscovery.useCommandDiscovery).toHaveBeenCalled();
    expect(useChatStore.getState().activeSessionKey).toBe("sess-1");
    expect(useChatStore.getState().sessionMetas[0]).toMatchObject({
      key: "sess-1",
      title: "Primary Session",
      model: "gpt-5.4",
    });
    expect(useChatStore.getState().sessions.get("sess-1")?.a2uiState).toMatchObject({
      visible: true,
      surfaces: ["summary"],
    });
    expect(container.textContent).toContain("Hydrated from snapshot");
    // Chat-parity §5: 5-cell ChatContextBar uses bundle's __key/__val pattern
    // ("Context" key + "85%" val, no colon prefix) and replaces the old
    // "Compacted N times" warning chip with a "Compactions" cell + count.
    expect(container.textContent).toContain("Context");
    expect(container.textContent).toContain("85%");
    expect(container.textContent).toContain("Compactions");
    expect(container.textContent).toContain("Compact");
    expect(container.textContent).toContain("Canvas");
    expect(getCachedTranscript("sess-1")).toMatchObject([
      {
        id: "msg-1",
        role: "assistant",
        content: [{ type: "text", text: "Hydrated from snapshot" }],
      },
    ]);
  });

  it("uses cached transcript messages while refreshing the selected Gateway session", async () => {
    deckApi.fetchSessions.mockResolvedValue({
      sessions: [{ key: "sess-1", agentId: "main", title: "Primary Session", updatedAt: 10 }],
    });
    deckApi.fetchChatSnapshot.mockReturnValue(new Promise(() => {}));
    setCachedTranscript("sess-1", [
      {
        id: "cached-1",
        role: "assistant",
        content: [{ type: "text", text: "Cached transcript" }],
        timestamp: 15,
      },
    ]);

    renderPanel();

    await vi.waitFor(() => {
      expect(container.textContent).toContain("Cached transcript");
    });
    expect(deckApi.fetchChatSnapshot).toHaveBeenCalledWith({
      sessionKey: "sess-1",
      agentId: "main",
    });
  });

  it("fills the migrated message input from an empty-state suggested prompt", async () => {
    deckApi.fetchSessions.mockResolvedValue({ sessions: [] });

    renderPanel();

    await vi.waitFor(() => {
      expect(container.textContent).toContain("Create something");
    });

    const suggestion = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Create something",
    );
    expect(suggestion).toBeTruthy();

    act(() => {
      suggestion?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await vi.waitFor(() => {
      const textarea = container.querySelector<HTMLTextAreaElement>(
        'textarea[placeholder="Type a message..."]',
      );
      expect(textarea?.value).toBe("Create something");
    });
    expect(deckApi.fetchChatSnapshot).not.toHaveBeenCalled();
  });

  it("subscribes and unsubscribes the selected session event stream", async () => {
    deckApi.fetchSessions.mockResolvedValue({
      sessions: [{ key: "sess-1", agentId: "main", title: "Primary Session", updatedAt: 10 }],
    });
    deckApi.fetchChatSnapshot.mockResolvedValue({
      messages: [],
      session: null,
      activeApproval: null,
      a2uiState: null,
    });

    renderPanel();

    await vi.waitFor(() => {
      expect(deckApi.setSessionEventsSubscription).toHaveBeenCalledWith({
        action: "subscribe",
        sessionKey: "sess-1",
      });
    });

    unmountPanel();

    await vi.waitFor(() => {
      expect(deckApi.setSessionEventsSubscription).toHaveBeenCalledWith({
        action: "unsubscribe",
        sessionKey: "sess-1",
      });
    });
  });

  it("opens detected tool-result artifacts in the migrated right panel", async () => {
    const artifactContent = JSON.stringify({
      name: "report",
      items: [1, 2, 3],
      nested: { ok: true },
    });
    deckApi.fetchSessions.mockResolvedValue({
      sessions: [{ key: "sess-1", agentId: "main", title: "Primary Session", updatedAt: 10 }],
    });
    deckApi.fetchChatSnapshot.mockResolvedValue({
      messages: [
        {
          id: "msg-1",
          role: "assistant",
          content: [
            {
              type: "tool_use",
              id: "tool-1",
              name: "write_file",
              input: { path: "/tmp/report.json" },
            },
            {
              type: "tool_result",
              toolUseId: "tool-1",
              content: artifactContent,
            },
          ],
          timestamp: 20,
        },
      ],
      session: null,
      activeApproval: null,
      a2uiState: { visible: true, surfaces: ["summary"] },
    });

    renderPanel();

    await vi.waitFor(() => {
      expect(container.textContent).toContain("Open Artifact");
    });

    const openButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Open Artifact",
    );
    expect(openButton).toBeTruthy();

    act(() => {
      openButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await vi.waitFor(() => {
      expect(container.textContent).toContain("report.json");
      expect(container.textContent).toContain('"name":"report"');
    });
    expect(chatApi.persistChatProjection).toHaveBeenCalledWith({
      sessionKey: "sess-1",
      a2uiState: expect.objectContaining({ visible: false }),
    });
  });

  it("auto-opens canvas from snapshot state and persists close projection", async () => {
    deckApi.fetchSessions.mockResolvedValue({
      sessions: [{ key: "sess-1", agentId: "main", title: "Primary Session", updatedAt: 10 }],
    });
    deckApi.fetchChatSnapshot.mockResolvedValue({
      messages: [],
      session: null,
      activeApproval: null,
      a2uiState: { visible: true, url: "preview.html", surfaces: ["summary"] },
    });

    renderPanel();

    await vi.waitFor(() => {
      expect(container.textContent).toContain("Collapse canvas");
    });

    const closeButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Collapse canvas",
    );
    expect(closeButton).toBeTruthy();

    act(() => {
      closeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await vi.waitFor(() => {
      expect(chatApi.persistChatProjection).toHaveBeenCalledWith({
        sessionKey: "sess-1",
        a2uiState: expect.objectContaining({ visible: false }),
      });
    });
    expect(useChatStore.getState().sessions.get("sess-1")?.a2uiState).toMatchObject({
      visible: false,
    });
  });

  it("keeps a locally opened canvas when a late snapshot has no A2UI projection", async () => {
    let resolveSnapshot:
      | ((value: { activeApproval: null; a2uiState: null; messages: []; session: null }) => void)
      | null = null;
    deckApi.fetchSessions.mockResolvedValue({
      sessions: [{ key: "sess-1", agentId: "main", title: "Primary Session", updatedAt: 10 }],
    });
    deckApi.fetchChatSnapshot.mockReturnValue(
      new Promise((resolve) => {
        resolveSnapshot = resolve;
      }),
    );

    renderPanel();

    await vi.waitFor(() => {
      expect(useChatStore.getState().activeSessionKey).toBe("sess-1");
    });

    const canvasButton = await vi.waitFor(() => {
      const button = Array.from(container.querySelectorAll("button")).find(
        (candidate) => candidate.textContent === "Canvas panel",
      );
      expect(button).toBeTruthy();
      return button;
    });

    act(() => {
      canvasButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await vi.waitFor(() => {
      expect(container.querySelector('[data-right-panel-mode="canvas"]')).toBeTruthy();
    });

    await act(async () => {
      resolveSnapshot?.({
        activeApproval: null,
        a2uiState: null,
        messages: [],
        session: null,
      });
      await Promise.resolve();
    });

    await vi.waitFor(() => {
      expect(container.querySelector('[data-right-panel-mode="canvas"]')).toBeTruthy();
    });
  });

  it("restores the old resizable right-panel width persistence", async () => {
    window.localStorage.setItem("deck:rightPanelWidth", "640");
    deckApi.fetchSessions.mockResolvedValue({
      sessions: [{ key: "sess-1", agentId: "main", title: "Primary Session", updatedAt: 10 }],
    });
    deckApi.fetchChatSnapshot.mockResolvedValue({
      messages: [],
      session: null,
      activeApproval: null,
      a2uiState: { visible: true, url: "preview.html", surfaces: ["summary"] },
    });

    renderPanel();

    const panel = await vi.waitFor(() => {
      const found = container.querySelector<HTMLElement>('[data-right-panel-mode="canvas"]');
      expect(found).toBeTruthy();
      if (!found) {
        throw new Error("missing right panel");
      }
      return found;
    });
    expect(panel.style.width).toBe("640px");

    const handle = container.querySelector<HTMLElement>("[data-right-panel-resize-handle]");
    expect(handle).toBeTruthy();

    act(() => {
      handle?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, clientX: 600 }));
      document.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX: 500 }));
      document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    });

    await vi.waitFor(() => {
      expect(panel.style.width).toBe("740px");
    });
    expect(window.localStorage.getItem("deck:rightPanelWidth")).toBe("740");
  });

  it("clears right-panel artifact state when switching active sessions", async () => {
    const artifactContent = JSON.stringify({ name: "report", ok: true });
    deckApi.fetchSessions.mockResolvedValue({
      sessions: [
        { key: "sess-1", agentId: "main", title: "Primary Session", updatedAt: 10 },
        { key: "sess-2", agentId: "main", title: "Second Session", updatedAt: 9 },
      ],
    });
    deckApi.fetchChatSnapshot.mockImplementation(async ({ sessionKey }: { sessionKey: string }) => {
      if (sessionKey === "sess-2") {
        return {
          messages: [
            {
              id: "msg-2",
              role: "assistant",
              content: [{ type: "text", text: "Second session transcript" }],
              timestamp: 30,
            },
          ],
          session: null,
          activeApproval: null,
          a2uiState: null,
        };
      }
      return {
        messages: [
          {
            id: "msg-1",
            role: "assistant",
            content: [
              {
                type: "tool_use",
                id: "tool-1",
                name: "write_file",
                input: { path: "/tmp/report.json" },
              },
              {
                type: "tool_result",
                toolUseId: "tool-1",
                content: artifactContent,
              },
            ],
            timestamp: 20,
          },
        ],
        session: null,
        activeApproval: null,
        a2uiState: null,
      };
    });

    renderPanel();

    await vi.waitFor(() => {
      expect(container.textContent).toContain("Open Artifact");
    });

    const openButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Open Artifact",
    );
    act(() => {
      openButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await vi.waitFor(() => {
      expect(container.textContent).toContain("report.json");
    });

    act(() => {
      useChatStore.getState().setActiveSession("sess-2");
    });

    await vi.waitFor(() => {
      expect(container.textContent).toContain("Second session transcript");
    });
    expect(container.textContent).not.toContain("report.json");
  });

  it("navigates transcript search matches without hiding nonmatching messages", async () => {
    deckApi.fetchSessions.mockResolvedValue({
      sessions: [{ key: "sess-1", agentId: "main", title: "Primary Session", updatedAt: 10 }],
    });
    deckApi.fetchChatSnapshot.mockResolvedValue({
      messages: [
        {
          id: "msg-1",
          role: "assistant",
          content: [{ type: "text", text: "Needle result" }],
          timestamp: 20,
        },
        {
          id: "msg-2",
          role: "assistant",
          content: [
            {
              type: "tool_use",
              id: "tool-1",
              name: "read_file",
              input: { path: "other.ts" },
            },
          ],
          timestamp: 30,
        },
      ],
      session: null,
      activeApproval: null,
      a2uiState: null,
    });

    renderPanel();

    await vi.waitFor(() => {
      expect(container.textContent).toContain("Needle result");
      expect(container.textContent).toContain("read_file");
    });

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "f",
          metaKey: true,
          bubbles: true,
        }),
      );
    });

    const input = container.querySelector<HTMLInputElement>(
      'input[placeholder="Search messages..."]',
    );
    expect(input).toBeTruthy();

    act(() => {
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      valueSetter?.call(input, "needle");
      input!.dispatchEvent(new Event("input", { bubbles: true }));
    });

    await vi.waitFor(() => {
      expect(container.textContent).toContain("1/1");
      expect(container.textContent).toContain("Needle result");
      expect(container.textContent).toContain("read_file");
    });
  });

  it("focuses transcript search with the migrated Cmd/Ctrl+F shortcut", async () => {
    deckApi.fetchSessions.mockResolvedValue({
      sessions: [{ key: "sess-1", agentId: "main", title: "Primary Session", updatedAt: 10 }],
    });
    deckApi.fetchChatSnapshot.mockResolvedValue({
      messages: [
        {
          id: "msg-1",
          role: "assistant",
          content: [{ type: "text", text: "Searchable transcript" }],
          timestamp: 20,
        },
      ],
      session: null,
      activeApproval: null,
      a2uiState: null,
    });

    renderPanel();

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "f",
          metaKey: true,
          bubbles: true,
        }),
      );
    });

    const input = await vi.waitFor(() => {
      const found = container.querySelector<HTMLInputElement>(
        'input[placeholder="Search messages..."]',
      );
      expect(found).toBeTruthy();
      return found;
    });

    await vi.waitFor(() => {
      expect(document.activeElement).toBe(input);
    });
  });

  it("steers a streaming session through the migrated chat API", async () => {
    deckApi.fetchSessions.mockResolvedValue({
      sessions: [{ key: "sess-1", agentId: "main", title: "Primary Session", updatedAt: 10 }],
    });
    deckApi.fetchChatSnapshot.mockResolvedValue({
      messages: [],
      session: null,
      activeApproval: null,
      a2uiState: null,
    });

    renderPanel();

    await vi.waitFor(() => {
      expect(useChatStore.getState().activeSessionKey).toBe("sess-1");
    });

    act(() => {
      useChatStore.getState().setSessionStreaming("sess-1", true);
    });

    await vi.waitFor(() => {
      expect(container.querySelector('input[placeholder="Steer active session..."]')).toBeTruthy();
    });

    const input = container.querySelector<HTMLInputElement>(
      'input[placeholder="Steer active session..."]',
    );
    expect(input).toBeTruthy();

    const quickAccessButton = await vi.waitFor(() => {
      const button = Array.from(container.querySelectorAll("button")).find(
        (candidate) => candidate.textContent === "Go to steer",
      );
      expect(button).toBeTruthy();
      return button;
    });
    if (!quickAccessButton) {
      throw new Error("missing steer quick access button");
    }

    act(() => {
      quickAccessButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(document.activeElement).toBe(input);

    act(() => {
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      valueSetter?.call(input, "focus on tests");
      input!.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const steerButton = await vi.waitFor(() => {
      const button = Array.from(container.querySelectorAll("button")).find(
        (candidate) => candidate.textContent === "Steer",
      );
      expect(button).toBeTruthy();
      expect(button?.disabled).toBe(false);
      return button;
    });
    if (!steerButton) {
      throw new Error("missing steer button");
    }

    act(() => {
      steerButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await vi.waitFor(() => {
      expect(chatApi.steerChatSession).toHaveBeenCalledWith({
        sessionKey: "sess-1",
        message: "focus on tests",
      });
    });
    await vi.waitFor(() => {
      expect(input?.value).toBe("");
      expect(document.activeElement).toBe(input);
    });
  });
});

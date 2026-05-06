// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const chatState = {
  sessions: new Map<string, Record<string, unknown>>(),
  activeSessionKey: "sess-1" as string | null,
  activeAgentId: "main" as string | null,
  sessionMetas: [] as Array<Record<string, unknown>>,
  sessionMeta: [] as Array<Record<string, unknown>>,
  sessionPreviewOverlays: {} as Record<string, unknown>,
};

const resetSessionProjection = vi.fn();
const setSessionError = vi.fn();
const setSessionStreaming = vi.fn();
let sessionStreaming = false;

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, string>) => {
    const message = {
      placeholder: "Type a message...",
      send: "Send",
      abort: "Stop",
      canvasToggle: "Canvas panel",
      artifactToggle: "Artifact panel",
      error: "Error",
      mentionAgents: "Agents",
      cmd_session: "Session",
      cmd_model: "Model",
      cmd_tools: "Tools",
      cmd_agents: "Agents",
      cmd_skills: "Skills",
      cmd_plugins: "Plugins",
      cmd_more: "More",
      cmd_new: "Start new session",
      cmd_reset: "Reset session",
      cmd_compact: "Compact context",
      cmd_stop: "Stop current run",
      cmd_clear: "Clear messages",
      cmd_help: "Show available commands",
      cmdBack: "Back",
      cmdTagRemove: "Remove command tag",
      cmdTagPlaceholder: "Type command argument...",
      toastThink: "Thinking: {value}",
      toastUnknownCommand: "Unknown command: /{value}",
      toastNewSession: "New session created",
      toastStopped: "Stopped",
      toastStopFailed: "Failed to stop",
      toastCommandFailed: "Command failed",
      contextWarning: "Context window nearly full",
      promptTemplates: "Prompt Templates",
      templateAnalyze: "Analyze this code for issues",
      templateExplain: "Explain this concept step by step",
      templateWrite: "Help me write creative copy",
      templateDebug: "Debug this error and suggest fixes",
      templateSummarize: "Summarize the key points",
    } as Record<string, string>;
    return (message[key] ?? key).replace(
      /\{(\w+)\}/g,
      (_, name: string) => values?.[name] ?? `{${name}}`,
    );
  },
}));

vi.mock("@/stores/chat", () => ({
  useChatStore: Object.assign(
    (selector: (state: typeof chatState) => unknown) => selector(chatState),
    {
      getState: () => ({
        ...chatState,
        resetSessionProjection,
        setSessionError,
        setSessionStreaming,
        setActiveSession: vi.fn(),
        setSessionMetas: vi.fn(),
        mergeSessionPreviewOverlay: vi.fn(),
        addMessage: vi.fn(),
      }),
      setState: (
        updater:
          | Partial<typeof chatState>
          | ((state: typeof chatState) => Partial<typeof chatState>),
      ) => {
        const patch = typeof updater === "function" ? updater(chatState) : updater;
        Object.assign(chatState, patch);
      },
      subscribe: vi.fn(() => vi.fn()),
      destroy: vi.fn(),
    },
  ),
}));

vi.mock("@/stores/chat-hooks", () => ({
  useActiveSessionKey: () => chatState.activeSessionKey,
  useSessionA2UI: () => null,
  useSessionApproval: () => null,
  useSessionStreaming: () => ({
    isStreaming: sessionStreaming,
    runId: null,
  }),
}));

vi.mock("@/stores/approvals", () => ({
  useApprovalsStore: Object.assign(
    (
      selector: (state: {
        pending: unknown[];
        removePending: () => void;
        resolveApproval: () => Promise<boolean>;
      }) => unknown,
    ) =>
      selector({
        pending: [],
        removePending: () => {},
        resolveApproval: async () => true,
      }),
    {
      getState: () => ({ pending: [] }),
      setState: vi.fn(),
      subscribe: vi.fn(() => vi.fn()),
      destroy: vi.fn(),
    },
  ),
}));

vi.mock("../chat-api", async () => {
  const actual = await vi.importActual("../chat-api");
  return {
    ...actual,
    sendChatMessage: vi.fn().mockResolvedValue({ status: "started" }),
    createChatSession: vi.fn().mockResolvedValue({ key: "sess-created" }),
    abortChatRun: vi.fn(),
  };
});

let MessageInput: typeof import("../MessageInput").MessageInput;
let useAgentsStore: typeof import("@/stores/agents").useAgentsStore;
let useNotificationsStore: typeof import("@/stores/notifications").useNotificationsStore;
let createChatSession: typeof import("../chat-api").createChatSession;
let sendChatMessage: typeof import("../chat-api").sendChatMessage;
let abortChatRun: typeof import("../chat-api").abortChatRun;
let container: HTMLDivElement;
let root: Root | null = null;

beforeEach(async () => {
  vi.resetModules();
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  ({ MessageInput } = await import("../MessageInput"));
  ({ useAgentsStore } = await import("@/stores/agents"));
  ({ useNotificationsStore } = await import("@/stores/notifications"));
  ({ abortChatRun, createChatSession, sendChatMessage } = await import("../chat-api"));
  sessionStorage.clear();
  useAgentsStore.setState({
    agents: [
      { id: "main", name: "Main Agent", model: "gpt", status: "idle" },
      { id: "ops", name: "Ops Bot", model: "gpt", status: "idle" },
    ],
  });
  useNotificationsStore.setState({ toasts: [] });
  resetSessionProjection.mockClear();
  setSessionError.mockClear();
  setSessionStreaming.mockClear();
  vi.mocked(createChatSession).mockResolvedValue({ key: "sess-created" });
  vi.mocked(createChatSession).mockClear();
  vi.mocked(abortChatRun).mockResolvedValue({ ok: true });
  vi.mocked(abortChatRun).mockClear();
  vi.mocked(sendChatMessage).mockClear();
  sessionStreaming = false;
  chatState.activeSessionKey = "sess-1";
  chatState.sessions = new Map([["sess-1", { messages: [], isStreaming: false }]]);
  chatState.sessionMetas = [];
  chatState.sessionMeta = [];
  chatState.sessionPreviewOverlays = {};
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ ok: true, key: "sess-1" }), { status: 200 }),
  );

  container = document.createElement("div");
  document.body.appendChild(container);
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
});

function mountInput() {
  act(() => {
    root = createRoot(container);
    root.render(createElement(MessageInput));
  });
}

describe("MessageInput mention and slash interactions", () => {
  it("shows filtered mention candidates and inserts the selected agent", () => {
    mountInput();

    const input = screen.getByPlaceholderText("Type a message...") as HTMLTextAreaElement;
    act(() => {
      fireEvent.change(input, { target: { value: "ask @Ma" } });
    });

    expect(screen.getByText("Agents")).toBeTruthy();
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Main Agent" }));
    });

    expect(input.value).toBe("ask @Main Agent ");
  });

  it("shows registered slash commands and executes a selected local command", async () => {
    mountInput();

    const input = screen.getByPlaceholderText("Type a message...");
    act(() => {
      fireEvent.change(input, { target: { value: "/re" } });
    });

    const resetOption = screen.getByText("/reset");
    act(() => {
      fireEvent.mouseDown(resetOption);
    });

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/chat/sessions/reset",
        expect.objectContaining({ method: "POST" }),
      );
    });
    expect(resetSessionProjection).toHaveBeenCalledWith("sess-1");
  });

  it("shows toast feedback returned by local slash commands", async () => {
    mountInput();

    const input = screen.getByPlaceholderText("Type a message...");
    act(() => {
      fireEvent.change(input, { target: { value: "/think high" } });
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
      expect(useNotificationsStore.getState().toasts.at(-1)).toMatchObject({
        type: "success",
        message: "Thinking: high",
      });
    });
  });

  it("inserts a selected prompt template into the composer", () => {
    mountInput();

    const input = screen.getByPlaceholderText("Type a message...") as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: "prefix: " } });
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Prompt Templates" }));
    });
    const template = screen.getByRole("menuitem", { name: "Analyze this code for issues" });
    act(() => {
      fireEvent.click(template);
    });

    expect(input.value).toBe("prefix: Analyze this code for issues");
    expect(screen.queryByRole("menu", { name: "Prompt Templates" })).toBeNull();
  });

  it("rejects unknown slash commands with a toast instead of sending them as chat text", async () => {
    mountInput();

    const input = screen.getByPlaceholderText("Type a message...");
    act(() => {
      fireEvent.change(input, { target: { value: "/missing" } });
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
      expect(useNotificationsStore.getState().toasts.at(-1)).toMatchObject({
        type: "error",
        message: "Unknown command: /missing",
      });
    });
    expect(sendChatMessage).not.toHaveBeenCalled();
  });

  it("sends typed remote slash commands and closes the command palette", async () => {
    const { commandRegistry } = await import("@/lib/command-registry");
    const { SOURCE_PRIORITY } = await import("@/lib/command-types");
    commandRegistry.register({
      name: "status",
      source: "builtin",
      execMode: "remote",
      description: "Show current status",
      category: "more",
      priority: SOURCE_PRIORITY.builtin,
    });
    mountInput();

    const input = screen.getByPlaceholderText("Type a message...");
    act(() => {
      fireEvent.change(input, { target: { value: "/status" } });
    });
    expect(screen.getByRole("listbox")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
      expect(sendChatMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionKey: "sess-1",
          message: "/status",
        }),
      );
    });
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("shows the new-session toast only after session creation succeeds", async () => {
    mountInput();

    const input = screen.getByPlaceholderText("Type a message...");
    act(() => {
      fireEvent.change(input, { target: { value: "/new" } });
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
      expect(createChatSession).toHaveBeenCalledWith({ agentId: "main" });
    });
    expect(useNotificationsStore.getState().toasts.at(-1)).toMatchObject({
      type: "success",
      message: "New session created",
    });
  });

  it("shows command-specific error toast without session error when new-session creation fails", async () => {
    vi.mocked(createChatSession).mockRejectedValueOnce(new Error("create failed"));
    mountInput();

    const input = screen.getByPlaceholderText("Type a message...");
    act(() => {
      fireEvent.change(input, { target: { value: "/new" } });
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
      expect(useNotificationsStore.getState().toasts.at(-1)).toMatchObject({
        type: "error",
        message: "/new: create failed",
      });
    });
    expect(setSessionError).not.toHaveBeenCalled();
    expect(useNotificationsStore.getState().toasts).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ message: "New session created" })]),
    );
  });

  it("restores sent drafts with keyboard input history navigation", async () => {
    mountInput();

    const input = screen.getByPlaceholderText("Type a message...") as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: "remember this" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
      expect(sendChatMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionKey: "sess-1",
          message: "remember this",
        }),
      );
    });
    await waitFor(() => {
      expect(input.value).toBe("");
    });

    act(() => {
      fireEvent.keyDown(input, { key: "ArrowUp" });
    });
    await waitFor(() => {
      expect(input.value).toBe("remember this");
    });

    act(() => {
      fireEvent.keyDown(input, { key: "ArrowDown" });
    });
    await waitFor(() => {
      expect(input.value).toBe("");
    });
  });

  it("warns before sending when the active session context is nearly full", () => {
    chatState.sessionMetas = [
      {
        key: "sess-1",
        totalTokens: 960,
        contextTokens: 1000,
      },
    ];
    chatState.sessionMeta = chatState.sessionMetas;

    mountInput();

    expect(screen.getByRole("status").textContent).toBe("Context window nearly full");
  });

  it("aborts the active run with local streaming state and toast feedback", async () => {
    sessionStreaming = true;
    mountInput();

    fireEvent.click(screen.getByRole("button", { name: "Stop" }));

    await waitFor(() => {
      expect(abortChatRun).toHaveBeenCalledWith({ sessionKey: "sess-1" });
    });
    expect(setSessionStreaming).toHaveBeenCalledWith("sess-1", false);
    expect(useNotificationsStore.getState().toasts.at(-1)).toMatchObject({
      type: "success",
      message: "Stopped",
    });
  });

  it("shows a failed-stop toast when there is no active session to abort", async () => {
    chatState.activeSessionKey = null;
    mountInput();

    const input = screen.getByPlaceholderText("Type a message...");
    act(() => {
      fireEvent.change(input, { target: { value: "/stop" } });
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
      expect(useNotificationsStore.getState().toasts.at(-1)).toMatchObject({
        type: "error",
        message: "Failed to stop",
      });
    });
    expect(abortChatRun).not.toHaveBeenCalled();
  });
});

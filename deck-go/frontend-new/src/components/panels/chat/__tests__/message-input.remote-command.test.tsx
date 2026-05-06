// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const chatState = {
  sessions: new Map<string, Record<string, unknown>>(),
  activeSessionKey: null as string | null,
  activeAgentId: "main" as string | null,
  sessionMetas: [] as Array<Record<string, unknown>>,
  sessionMeta: [] as Array<Record<string, unknown>>,
  sessionPreviewOverlays: {} as Record<
    string,
    { text: string; updatedAt: number; source: "optimistic" | "remote" }
  >,
};

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) =>
    (
      ({
        placeholder: "Type a message...",
        send: "Send",
        abort: "Stop",
        canvasToggle: "Canvas panel",
        artifactToggle: "Artifact panel",
        error: "Error",
      }) as Record<string, string>
    )[key] ?? key,
}));

vi.mock("@/hooks/useMention", () => ({
  useMention: () => ({
    showMention: false,
    mentionFilter: "",
    handleMentionInput: () => {},
    selectMention: (agentName: string, inputValue: string) => `${inputValue}@${agentName}`,
    closeMention: () => {},
  }),
}));

vi.mock("@/hooks/useSlashCommand", () => ({
  resolveSelectMode: () => "immediate",
  useSlashCommand: (input: string) => ({
    showPalette: input.startsWith("/"),
    slashFilter: input.slice(1),
    paletteIndex: 0,
    ghostHint: "",
    navigableCommandsRef: { current: [] },
    handleSlashInput: () => true,
    handlePaletteKeyDown: () => false,
    closePalette: () => {},
    setPaletteIndex: () => {},
    activeTag: null,
    clearTag: () => {},
    enterArgOptionsMode: () => {},
    enterTagMode: () => {},
    argOptionsState: null,
    exitArgOptionsMode: () => {},
    setArgOptionsIndex: () => {},
  }),
}));

vi.mock("@/stores/chat", () => ({
  useChatStore: Object.assign(
    (selector: (state: typeof chatState) => unknown) => selector(chatState),
    {
      getState: () => ({
        ...chatState,
        setActiveSession: (key: string | null) => {
          chatState.activeSessionKey = key;
        },
        setSessionMetas: (metas: Array<Record<string, unknown>>) => {
          chatState.sessionMetas = metas;
          chatState.sessionMeta = metas;
        },
        mergeSessionPreviewOverlay: (
          key: string,
          overlay: { text: string; updatedAt: number; source: "optimistic" | "remote" },
        ) => {
          chatState.sessionPreviewOverlays[key] = overlay;
        },
        addMessage: (key: string, message: Record<string, unknown>) => {
          const session = chatState.sessions.get(key) ?? {};
          const messages = Array.isArray(session.messages) ? session.messages : [];
          chatState.sessions.set(key, { ...session, messages: [...messages, message] });
        },
        setSessionStreaming: (key: string, streaming: boolean) => {
          const session = chatState.sessions.get(key);
          if (session) {
            session.isStreaming = streaming;
          }
        },
        setSessionError: (key: string, error: string | null) => {
          const session = chatState.sessions.get(key);
          if (session) {
            session.error = error;
          }
        },
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
  useSessionApproval: () => null,
  useSessionStreaming: () => ({
    isStreaming: Boolean(
      chatState.activeSessionKey && chatState.sessions.get(chatState.activeSessionKey)?.isStreaming,
    ),
    runId: null,
  }),
}));

vi.mock("../useInputHistory", () => ({
  useInputHistory: () => ({
    push: () => {},
    up: () => null,
    down: () => null,
    reset: () => {},
  }),
}));

vi.mock("../SlashCommandPalette", () => ({
  SlashCommandPalette: ({
    onSelect,
  }: {
    onSelect: (cmd: { name: string; execMode: string }) => void;
  }) => (
    <button type="button" onClick={() => onSelect({ name: "remote", execMode: "remote" })}>
      Select Remote
    </button>
  ),
}));

vi.mock("../ApprovalDialog", () => ({ ApprovalDialog: () => null }));
vi.mock("../MentionPopover", () => ({ MentionPopover: () => null }));
vi.mock("../PromptTemplateMenu", () => ({ PromptTemplateMenu: () => null }));
vi.mock("../message-input-helpers", () => ({
  MAX_ATTACHMENT_BYTES: 5 * 1024 * 1024,
  readFileAsBase64: vi.fn(),
  attachmentType: vi.fn(),
  formatSize: vi.fn(),
  FileAttachmentBar: () => null,
  CanvasToggle: ({ label }: { label: string }) => <button type="button">{label}</button>,
  ArtifactToggle: ({ label }: { label: string }) => <button type="button">{label}</button>,
}));

vi.mock("../chat-api", async () => {
  const actual = await vi.importActual("../chat-api");
  return {
    ...actual,
    sendChatMessage: vi.fn().mockResolvedValue({ status: "started" }),
    createChatSession: vi.fn(),
    abortChatRun: vi.fn(),
  };
});

let MessageInput: typeof import("../MessageInput").MessageInput;
let useChatStore: typeof import("@/stores/chat").useChatStore;
let createChatSession: typeof import("../chat-api").createChatSession;
let sendChatMessage: typeof import("../chat-api").sendChatMessage;
let container: HTMLDivElement;
let root: Root | null = null;

beforeEach(async () => {
  vi.resetModules();
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  ({ MessageInput } = await import("../MessageInput"));
  ({ useChatStore } = await import("@/stores/chat"));
  ({ createChatSession, sendChatMessage } = await import("../chat-api"));

  const metas = [{ key: "sess-1", agentId: "main", updatedAt: Date.now() }];
  useChatStore.setState({
    sessions: new Map([
      [
        "sess-1",
        {
          messages: [],
          isStreaming: false,
          status: "idle",
          streamingRunId: null,
          error: null,
          toolProgress: {},
          activeApproval: null,
          runMetadata: {},
          commandStates: {},
          a2uiState: null,
          lastAccessedAt: Date.now(),
        },
      ],
    ]),
    activeSessionKey: "sess-1",
    activeAgentId: "main",
    sessionMetas: metas,
    sessionMeta: metas,
    sessionPreviewOverlays: {},
  });
  vi.mocked(createChatSession).mockResolvedValue({
    key: "sess-created",
  });
  vi.mocked(sendChatMessage).mockResolvedValue({ status: "started" });
  vi.mocked(sendChatMessage).mockClear();
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

describe("MessageInput remote slash command preview", () => {
  it("writes an optimistic session preview overlay for remote slash commands", async () => {
    act(() => {
      root = createRoot(container);
      root.render(createElement(MessageInput));
    });

    fireEvent.change(screen.getByPlaceholderText("Type a message..."), {
      target: { value: "/remote" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Select Remote" }));

    await waitFor(() => {
      expect(useChatStore.getState().sessionPreviewOverlays["sess-1"]?.text).toBe("/remote");
    });
    expect(useChatStore.getState().sessions.get("sess-1")?.messages).toMatchObject([
      {
        role: "user",
        content: [{ type: "text", text: "/remote" }],
      },
    ]);
  });

  it("writes an optimistic preview when a remote slash command creates a new session", async () => {
    useChatStore.setState({
      activeSessionKey: null,
      sessions: new Map(),
      sessionMetas: [],
      sessionMeta: [],
      sessionPreviewOverlays: {},
    });

    act(() => {
      root = createRoot(container);
      root.render(createElement(MessageInput));
    });

    fireEvent.change(screen.getByPlaceholderText("Type a message..."), {
      target: { value: "/remote" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Select Remote" }));

    await waitFor(() => {
      expect(useChatStore.getState().activeSessionKey).toBe("sess-created");
    });
    expect(useChatStore.getState().sessionPreviewOverlays["sess-created"]?.text).toBe("/remote");
    expect(useChatStore.getState().sessions.get("sess-created")?.messages).toMatchObject([
      {
        role: "user",
        content: [{ type: "text", text: "/remote" }],
      },
    ]);
  });

  it("does not resend the first message when session creation already started the run", async () => {
    vi.mocked(createChatSession).mockResolvedValue({
      key: "sess-created",
      runStarted: true,
    });
    useChatStore.setState({
      activeSessionKey: null,
      sessions: new Map(),
      sessionMetas: [],
      sessionMeta: [],
      sessionPreviewOverlays: {},
    });

    act(() => {
      root = createRoot(container);
      root.render(createElement(MessageInput));
    });

    fireEvent.change(screen.getByPlaceholderText("Type a message..."), {
      target: { value: "hello from first message" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
      expect(useChatStore.getState().activeSessionKey).toBe("sess-created");
    });
    expect(createChatSession).toHaveBeenCalledWith({
      agentId: "main",
      message: "hello from first message",
    });
    expect(sendChatMessage).not.toHaveBeenCalled();
    expect(useChatStore.getState().sessionPreviewOverlays["sess-created"]?.text).toBe(
      "hello from first message",
    );
    expect(useChatStore.getState().sessions.get("sess-created")).toMatchObject({
      isStreaming: true,
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: "hello from first message" }],
        },
      ],
    });
  });

  it("surfaces session creation run errors without retrying the first message send", async () => {
    vi.mocked(createChatSession).mockResolvedValue({
      key: "sess-created",
      runError: { message: "gateway failed" },
    });
    useChatStore.setState({
      activeSessionKey: null,
      sessions: new Map(),
      sessionMetas: [],
      sessionMeta: [],
      sessionPreviewOverlays: {},
    });

    act(() => {
      root = createRoot(container);
      root.render(createElement(MessageInput));
    });

    fireEvent.change(screen.getByPlaceholderText("Type a message..."), {
      target: { value: "hello from failed run" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
      expect(useChatStore.getState().sessions.get("sess-created")?.error).toBe("gateway failed");
    });
    expect(sendChatMessage).not.toHaveBeenCalled();
    expect(useChatStore.getState().sessions.get("sess-created")).toMatchObject({
      isStreaming: false,
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: "hello from failed run" }],
        },
      ],
    });
  });

  it("applies local slash config updates to the active session meta", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));

    act(() => {
      root = createRoot(container);
      root.render(createElement(MessageInput));
    });

    fireEvent.change(screen.getByPlaceholderText("Type a message..."), {
      target: { value: "/think high" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
      expect(useChatStore.getState().sessionMetas[0]).toMatchObject({
        key: "sess-1",
        thinkingLevel: "high",
      });
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/chat/sessions/patch",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ sessionKey: "sess-1", thinkingLevel: "high" }),
      }),
    );
  });

  it("does not apply local slash config updates when the patch route fails", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "patch failed" }), {
        status: 500,
      }),
    );
    const { useNotificationsStore } = await import("@/stores/notifications");

    act(() => {
      root = createRoot(container);
      root.render(createElement(MessageInput));
    });

    fireEvent.change(screen.getByPlaceholderText("Type a message..."), {
      target: { value: "/think high" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
      expect(useNotificationsStore.getState().toasts.at(-1)).toMatchObject({
        type: "error",
        message: "toastThinkFailed",
      });
    });
    expect(useChatStore.getState().sessionMetas[0]).toMatchObject({
      key: "sess-1",
    });
    expect(useChatStore.getState().sessionMetas[0]).not.toHaveProperty("thinkingLevel");
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/chat/sessions/patch",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ sessionKey: "sess-1", thinkingLevel: "high" }),
      }),
    );
  });

  it("applies slash command aliases and usage modes to the active session meta", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));

    act(() => {
      root = createRoot(container);
      root.render(createElement(MessageInput));
    });

    fireEvent.change(screen.getByPlaceholderText("Type a message..."), {
      target: { value: "/t high" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
      expect(useChatStore.getState().sessionMetas[0]).toMatchObject({
        key: "sess-1",
        thinkingLevel: "high",
      });
    });

    fireEvent.change(screen.getByPlaceholderText("Type a message..."), {
      target: { value: "/usage tokens" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
      expect(useChatStore.getState().sessionMetas[0]).toMatchObject({
        key: "sess-1",
        responseUsage: "tokens",
      });
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/chat/sessions/patch",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ sessionKey: "sess-1", thinkingLevel: "high" }),
      }),
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/chat/sessions/patch",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ sessionKey: "sess-1", responseUsage: "tokens" }),
      }),
    );
  });
});

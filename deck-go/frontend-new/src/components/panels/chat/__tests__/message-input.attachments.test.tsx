// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { act, createElement, type FunctionComponent, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MessageInputProps } from "../MessageInput";

const chatState = {
  sessions: new Map<string, Record<string, unknown>>(),
  activeSessionKey: "sess-1" as string | null,
  activeAgentId: "main" as string | null,
  sessionMetas: [] as Array<Record<string, unknown>>,
  sessionMeta: [] as Array<Record<string, unknown>>,
  sessionPreviewOverlays: {} as Record<
    string,
    { text: string; updatedAt: number; source: "optimistic" | "remote" }
  >,
};

const addedMessages: Array<Record<string, unknown>> = [];

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
  useSlashCommand: () => ({
    showPalette: false,
    slashFilter: "",
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
          addedMessages.push({ key, ...message });
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
  useSessionA2UI: () => null,
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

vi.mock("../SlashCommandPalette", () => ({ SlashCommandPalette: () => null }));
vi.mock("../PromptTemplateMenu", () => ({ PromptTemplateMenu: () => null }));

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
let useChatStore: typeof import("@/stores/chat").useChatStore;
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
  ({ sendChatMessage } = await import("../chat-api"));

  addedMessages.length = 0;
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
          a2uiState: null,
          lastAccessedAt: Date.now(),
        },
      ],
    ]),
    activeSessionKey: "sess-1",
    activeAgentId: "main",
    sessionMetas: [{ key: "sess-1", agentId: "main", updatedAt: Date.now() }],
    sessionMeta: [{ key: "sess-1", agentId: "main", updatedAt: Date.now() }],
    sessionPreviewOverlays: {},
  });
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

function mountInput(element: ReactNode = createElement(MessageInput)) {
  act(() => {
    root = createRoot(container);
    root.render(element);
  });
}

function createMessageInputElement(props: MessageInputProps) {
  return createElement(MessageInput as FunctionComponent<MessageInputProps>, props);
}

describe("MessageInput attachments", () => {
  it("sends attachment payloads with the active session message", async () => {
    mountInput();

    const file = new File(["hello"], "hello.txt", { type: "text/plain" });
    fireEvent.change(screen.getByLabelText("File attachments"), {
      target: { files: [file] },
    });
    fireEvent.change(screen.getByPlaceholderText("Type a message..."), {
      target: { value: "see attached" },
    });

    expect(screen.getByText("hello.txt")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
      expect(sendChatMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionKey: "sess-1",
          message: "see attached",
          attachments: [
            expect.objectContaining({
              type: "file",
              mimeType: "text/plain",
              fileName: "hello.txt",
              content: "aGVsbG8=",
            }),
          ],
        }),
      );
    });
    expect(useChatStore.getState().sessionPreviewOverlays["sess-1"]?.text).toContain("hello.txt");
    expect(addedMessages[0]?.content).toEqual([
      { type: "text", text: "see attached\n[hello.txt]" },
    ]);
  });

  it("lets attachment-only messages bypass controlled text send disabling", async () => {
    const onSendMessage = vi.fn();
    mountInput(
      createMessageInputElement({
        value: "",
        onChange: vi.fn(),
        onSendMessage,
        sendDisabled: true,
      }),
    );

    const file = new File(["image"], "diagram.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("File attachments"), {
      target: { files: [file] },
    });

    const sendButton = screen.getByRole("button", { name: "Send" });
    expect((sendButton as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(sendChatMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionKey: "sess-1",
          message: "diagram.png",
          attachments: [
            expect.objectContaining({
              type: "image",
              fileName: "diagram.png",
            }),
          ],
        }),
      );
    });
    expect(onSendMessage).not.toHaveBeenCalled();
  });

  it("rejects files over the attachment limit before sending", async () => {
    mountInput();

    const largeFile = new File(["x"], "too-large.bin", {
      type: "application/octet-stream",
    });
    Object.defineProperty(largeFile, "size", {
      configurable: true,
      value: 6 * 1024 * 1024,
    });

    fireEvent.change(screen.getByLabelText("File attachments"), {
      target: { files: [largeFile] },
    });

    expect(screen.queryByText("too-large.bin")).toBeNull();
    expect(chatState.sessions.get("sess-1")?.error).toContain("too-large.bin exceeds");
    expect(sendChatMessage).not.toHaveBeenCalled();
  });
});

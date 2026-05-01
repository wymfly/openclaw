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

const approvalsState = {
  pending: [] as Array<Record<string, unknown>>,
  removePending: vi.fn(),
  resolveApproval: vi.fn(),
};

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => (key: string) =>
    (
      ({
        chat: {
          placeholder: "Type a message...",
          send: "Send",
          abort: "Stop",
          canvasToggle: "Canvas panel",
          artifactToggle: "Artifact panel",
          error: "Error",
          toastCommandFailed: "Command failed",
        },
        approvals: {
          inlineTitle: "Approval required",
          approve: "Approve",
          approveAlways: "Always Approve",
          deny: "Deny",
          pendingBadge: "pending",
        },
      }) as Record<string, Record<string, string>>
    )[namespace ?? "chat"]?.[key] ?? key,
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
        setActiveApproval: (key: string, approval: Record<string, unknown> | null) => {
          const session = chatState.sessions.get(key);
          if (session) {
            session.activeApproval = approval;
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
  useSessionApproval: () =>
    chatState.activeSessionKey
      ? (chatState.sessions.get(chatState.activeSessionKey)?.activeApproval ?? null)
      : null,
  useSessionStreaming: () => ({
    isStreaming: false,
    runId: null,
  }),
}));

vi.mock("@/stores/approvals", () => ({
  useApprovalsStore: Object.assign(
    (selector: (state: typeof approvalsState) => unknown) => selector(approvalsState),
    {
      getState: () => approvalsState,
      setState: (patch: Partial<typeof approvalsState>) => Object.assign(approvalsState, patch),
      subscribe: vi.fn(() => vi.fn()),
      destroy: vi.fn(),
    },
  ),
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
let useNotificationsStore: typeof import("@/stores/notifications").useNotificationsStore;
let container: HTMLDivElement;
let root: Root | null = null;

beforeEach(async () => {
  vi.resetModules();
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  ({ MessageInput } = await import("../MessageInput"));
  ({ useNotificationsStore } = await import("@/stores/notifications"));
  useNotificationsStore.setState({ toasts: [] });

  approvalsState.pending = [];
  approvalsState.removePending = vi.fn();
  approvalsState.resolveApproval = vi.fn().mockResolvedValue(true);
  chatState.sessions = new Map([
    [
      "sess-1",
      {
        messages: [],
        isStreaming: false,
        activeApproval: null,
      },
    ],
  ]);
  chatState.activeSessionKey = "sess-1";

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

describe("MessageInput approvals", () => {
  it("renders the active approval and clears it after a successful decision", async () => {
    chatState.sessions.get("sess-1")!.activeApproval = {
      id: "approval-1",
      toolName: "shell",
      command: "npm test",
      expiresAtMs: Date.now() + 60_000,
    };
    approvalsState.pending = [{ id: "approval-1" }];

    mountInput();

    expect(screen.getByText("Approval required")).toBeTruthy();
    expect(screen.getByText("npm test")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() => {
      expect(approvalsState.resolveApproval).toHaveBeenCalledWith("approval-1", "allow-once");
    });
    expect(chatState.sessions.get("sess-1")?.activeApproval).toBeNull();
  });

  it("shows command-failed toast and keeps approval active when decision fails", async () => {
    chatState.sessions.get("sess-1")!.activeApproval = {
      id: "approval-failed",
      toolName: "shell",
      command: "npm test",
      expiresAtMs: Date.now() + 60_000,
    };
    approvalsState.pending = [{ id: "approval-failed" }];
    approvalsState.resolveApproval = vi.fn().mockResolvedValue(false);

    mountInput();

    fireEvent.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() => {
      expect(approvalsState.resolveApproval).toHaveBeenCalledWith("approval-failed", "allow-once");
    });
    expect(useNotificationsStore.getState().toasts.at(-1)).toMatchObject({
      type: "error",
      message: "Command failed",
    });
    expect(chatState.sessions.get("sess-1")?.activeApproval).toMatchObject({
      id: "approval-failed",
    });
  });

  it("removes expired active approvals from both stores", async () => {
    chatState.sessions.get("sess-1")!.activeApproval = {
      id: "approval-expired",
      toolName: "shell",
      command: "npm test",
      expiresAtMs: Date.now() - 1,
    };
    approvalsState.pending = [{ id: "approval-expired" }];

    mountInput();

    await waitFor(() => {
      expect(approvalsState.removePending).toHaveBeenCalledWith("approval-expired");
    });
    expect(chatState.sessions.get("sess-1")?.activeApproval).toBeNull();
  });
});

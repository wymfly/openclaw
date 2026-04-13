// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) =>
    (
      ({
        placeholder: "Type a message...",
        send: "Send",
        abort: "Stop",
        canvasToggle: "Canvas panel",
        artifactToggle: "Artifact panel",
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

beforeEach(async () => {
  vi.resetModules();
  ({ MessageInput } = await import("../MessageInput"));
  ({ useChatStore } = await import("@/stores/chat"));
  ({ createChatSession } = await import("../chat-api"));

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
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("MessageInput remote slash command preview", () => {
  it("writes an optimistic session preview overlay for remote slash commands", async () => {
    render(createElement(MessageInput));

    fireEvent.change(screen.getByPlaceholderText("Type a message..."), {
      target: { value: "/remote" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Select Remote" }));

    await waitFor(() => {
      expect(useChatStore.getState().sessionPreviewOverlays["sess-1"]?.text).toBe("/remote");
    });
  });

  it("writes an optimistic preview when a remote slash command creates a new session", async () => {
    useChatStore.setState({
      activeSessionKey: null,
      sessions: new Map(),
      sessionMetas: [],
      sessionMeta: [],
      sessionPreviewOverlays: {},
    });

    render(createElement(MessageInput));

    fireEvent.change(screen.getByPlaceholderText("Type a message..."), {
      target: { value: "/remote" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Select Remote" }));

    await waitFor(() => {
      expect(useChatStore.getState().activeSessionKey).toBe("sess-created");
    });
    expect(useChatStore.getState().sessionPreviewOverlays["sess-created"]?.text).toBe("/remote");
  });
});

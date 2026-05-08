// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DataFabricTestProvider } from "@/data/testing/DataFabricTestProvider";

const chatState = {
  sessions: new Map(),
  activeAgentId: "main" as string | null,
  activeSessionKey: null as string | null,
  sessionMetas: [] as Array<Record<string, unknown>>,
  sessionMeta: [] as Array<Record<string, unknown>>,
  sessionPreviewOverlays: {} as Record<string, { text: string; updatedAt: number; source: string }>,
};
const removeSession = vi.fn((key: string) => {
  chatState.sessions.delete(key);
  chatState.sessionMetas = chatState.sessionMetas.filter((session) => session.key !== key);
  chatState.sessionMeta = chatState.sessionMetas;
  delete chatState.sessionPreviewOverlays[key];
  if (chatState.activeSessionKey === key) {
    chatState.activeSessionKey = null;
  }
});
const setSessionMetas = vi.fn((metas: Array<Record<string, unknown>>) => {
  chatState.sessionMetas = metas;
  chatState.sessionMeta = metas;
});

function getChatStoreSnapshot() {
  return {
    ...chatState,
    setActiveSession: (key: string | null) => {
      chatState.activeSessionKey = key;
    },
    setActiveAgent: (agentId: string | null) => {
      chatState.activeAgentId = agentId;
    },
    mergeSessionPreviewOverlay: (
      key: string,
      overlay: { text: string; updatedAt: number; source: string },
    ) => {
      chatState.sessionPreviewOverlays[key] = overlay;
    },
    clearSessionPreviewOverlay: (key: string) => {
      delete chatState.sessionPreviewOverlays[key];
    },
    setSessionMetas,
    removeSession,
  };
}

const agentsState = {
  agents: [] as Array<Record<string, unknown>>,
  fetchAgents: vi.fn(async () => {}),
};

const deckApi = vi.hoisted(() => ({
  deleteSession: vi.fn(),
  fetchSessionPreviews: vi.fn(),
  patchSession: vi.fn(),
}));

vi.mock("@/stores/chat", () => ({
  useChatStore: Object.assign(
    (selector: (state: ReturnType<typeof getChatStoreSnapshot>) => unknown) =>
      selector(getChatStoreSnapshot()),
    {
      getState: () => getChatStoreSnapshot(),
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
}));

vi.mock("@/stores/agents", () => ({
  normalizeAgentSummary: (agent: Record<string, unknown>) => {
    const id = typeof agent.id === "string" ? agent.id.trim() : "";
    const name = typeof agent.name === "string" && agent.name.trim() ? agent.name.trim() : id;
    return {
      ...agent,
      id,
      name,
      status: agent.status ?? "idle",
    };
  },
  useAgentsStore: Object.assign(
    (selector: (state: typeof agentsState) => unknown) => selector(agentsState),
    {
      getState: () => agentsState,
      setState: (
        updater:
          | Partial<typeof agentsState>
          | ((state: typeof agentsState) => Partial<typeof agentsState>),
      ) => {
        const patch = typeof updater === "function" ? updater(agentsState) : updater;
        Object.assign(agentsState, patch);
      },
      subscribe: vi.fn(() => vi.fn()),
      destroy: vi.fn(),
    },
  ),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) =>
    (
      ({
        defaultAgent: "Default agent",
        allAgents: "All",
        deleteConfirmCancel: "Cancel",
        deleteConfirmMessage: "Are you sure?",
        deleteConfirmOk: "Delete",
        deleteConfirmTitle: "Delete session",
        newSession: "New session",
        searchSessions: "Search sessions...",
      }) as const
    )[
      key as
        | "defaultAgent"
        | "allAgents"
        | "deleteConfirmCancel"
        | "deleteConfirmMessage"
        | "deleteConfirmOk"
        | "deleteConfirmTitle"
        | "newSession"
        | "searchSessions"
    ] ?? key,
}));

vi.mock("@/api", () => deckApi);
vi.mock("../chat-api", async () => {
  const actual = await vi.importActual<typeof import("../chat-api")>("../chat-api");
  return actual;
});

let SessionSidebar: typeof import("../SessionSidebar").SessionSidebar;
let useChatStore: typeof import("@/stores/chat").useChatStore;
let useAgentsStore: typeof import("@/stores/agents").useAgentsStore;
let deleteSession: typeof import("@/api").deleteSession;
let patchSession: typeof import("@/api").patchSession;
let fetchSessionPreviews: typeof import("@/api").fetchSessionPreviews;
let container: HTMLDivElement;
let root: Root | null = null;

const baseMeta = {
  key: "agent:main:web-1712188800000-abc123",
  agentId: "main",
  title: "Primary Session",
  updatedAt: Date.now(),
};

beforeEach(async () => {
  vi.resetModules();
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  ({ SessionSidebar } = await import("../SessionSidebar"));
  ({ useChatStore } = await import("@/stores/chat"));
  ({ useAgentsStore } = await import("@/stores/agents"));
  ({ deleteSession } = await import("@/api"));
  ({ patchSession } = await import("@/api"));
  ({ fetchSessionPreviews } = await import("@/api"));
  container = document.createElement("div");
  document.body.appendChild(container);

  const metas = [{ ...baseMeta }];
  useChatStore.setState({
    sessions: new Map(),
    activeAgentId: "main",
    activeSessionKey: baseMeta.key,
    sessionMetas: metas,
    sessionMeta: metas,
    sessionPreviewOverlays: {},
  });
  useAgentsStore.setState({
    agents: [{ id: "main", name: "Main", model: "gpt-5.4", status: "idle" }],
  });

  vi.mocked(patchSession).mockReset();
  vi.mocked(patchSession).mockResolvedValue({ ok: true, key: baseMeta.key });
  vi.mocked(deleteSession).mockReset();
  vi.mocked(deleteSession).mockResolvedValue({ ok: true, key: baseMeta.key });
  vi.mocked(fetchSessionPreviews).mockReset();
  vi.mocked(fetchSessionPreviews).mockResolvedValue({});
  vi.mocked(agentsState.fetchAgents).mockClear();
  removeSession.mockClear();
  setSessionMetas.mockClear();
});

afterEach(() => {
  if (root) {
    act(() => {
      root?.unmount();
    });
  }
  root = null;
  container.remove();
});

function mountSidebar() {
  act(() => {
    root = createRoot(container);
    root.render(
      createElement(
        DataFabricTestProvider,
        { gatewayRpc: async () => ({ agents: agentsState.agents }) },
        createElement(SessionSidebar),
      ),
    );
  });
}

function rerenderSidebar() {
  act(() => {
    root?.render(
      createElement(
        DataFabricTestProvider,
        { gatewayRpc: async () => ({ agents: agentsState.agents }) },
        createElement(SessionSidebar),
      ),
    );
  });
}

describe("SessionSidebar rename", () => {
  it("renders preview overlay text ahead of lastMessagePreview", () => {
    const metas = [{ ...baseMeta, lastMessagePreview: "fallback preview" }];
    useChatStore.setState({
      sessionMetas: metas,
      sessionMeta: metas,
      activeSessionKey: baseMeta.key,
      sessionPreviewOverlays: {
        [baseMeta.key]: {
          text: "remote preview",
          updatedAt: Date.now(),
          source: "remote",
        },
      },
    });

    mountSidebar();

    expect(screen.getByText("remote preview")).toBeTruthy();
    expect(screen.queryByText("fallback preview")).toBeNull();
  });

  it("searches against the final preview text", () => {
    const metas = [{ ...baseMeta, lastMessagePreview: "fallback preview" }];
    useChatStore.setState({
      sessionMetas: metas,
      sessionMeta: metas,
      activeSessionKey: baseMeta.key,
      sessionPreviewOverlays: {
        [baseMeta.key]: {
          text: "priority overlay",
          updatedAt: Date.now(),
          source: "remote",
        },
      },
    });

    mountSidebar();

    const searchInput = screen.getByPlaceholderText("Search sessions...");
    fireEvent.change(searchInput, { target: { value: "priority" } });

    expect(screen.getByText("Primary Session")).toBeTruthy();
  });

  it("falls back to lastMessagePreview when no overlay exists", () => {
    const metas = [{ ...baseMeta, lastMessagePreview: "fallback preview" }];
    useChatStore.setState({
      sessionMetas: metas,
      sessionMeta: metas,
      activeSessionKey: baseMeta.key,
      sessionPreviewOverlays: {},
    });

    mountSidebar();

    expect(screen.getByText("fallback preview")).toBeTruthy();
  });

  it("clears stale remote overlays when preview fetch returns empty", async () => {
    const metas = [{ ...baseMeta, lastMessagePreview: "fallback preview" }];
    vi.mocked(fetchSessionPreviews).mockResolvedValueOnce({ [baseMeta.key]: null });
    useChatStore.setState({
      sessionMetas: metas,
      sessionMeta: metas,
      activeSessionKey: baseMeta.key,
      sessionPreviewOverlays: {
        [baseMeta.key]: {
          text: "stale remote preview",
          updatedAt: Date.now(),
          source: "remote",
        },
      },
    });

    mountSidebar();

    await waitFor(() => {
      expect(chatState.sessionPreviewOverlays[baseMeta.key]).toBeUndefined();
    });
    rerenderSidebar();
    expect(screen.getByText("fallback preview")).toBeTruthy();
    expect(screen.queryByText("stale remote preview")).toBeNull();
  });

  it("filters visible sessions by the search query", () => {
    const metas = [
      { ...baseMeta, key: "sess-primary", title: "Primary Session" },
      { ...baseMeta, key: "sess-ops", title: "Ops Review" },
    ];
    useChatStore.setState({
      sessionMetas: metas,
      sessionMeta: metas,
      activeSessionKey: "sess-primary",
    });

    mountSidebar();

    const searchInput = screen.getByPlaceholderText("Search sessions...");
    expect(screen.getByText("Primary Session")).toBeTruthy();
    expect(screen.getByText("Ops Review")).toBeTruthy();

    fireEvent.change(searchInput, { target: { value: "ops" } });

    expect(screen.queryByText("Primary Session")).toBeNull();
    expect(screen.getByText("Ops Review")).toBeTruthy();

    fireEvent.change(searchInput, { target: { value: "" } });

    expect(screen.getByText("Primary Session")).toBeTruthy();
    expect(screen.getByText("Ops Review")).toBeTruthy();
  });

  it("filters sessions by backend label even when the visible title is generated", () => {
    const metas = [
      { ...baseMeta, key: "sess-primary", title: "Primary Session" },
      { ...baseMeta, key: "sess-run", title: "56d72dba (2026-05-06)", label: "run-scoped-label" },
    ];
    useChatStore.setState({
      sessionMetas: metas,
      sessionMeta: metas,
      activeSessionKey: "sess-primary",
    });

    mountSidebar();

    const searchInput = screen.getByPlaceholderText("Search sessions...");
    fireEvent.change(searchInput, { target: { value: "run-scoped-label" } });

    expect(screen.queryByText("Primary Session")).toBeNull();
    expect(screen.getByText("56d72dba (2026-05-06)")).toBeTruthy();
  });

  it("restores agent tabs with session counts and active-agent switching", async () => {
    const metas = [
      { ...baseMeta, key: "sess-main", agentId: "main", title: "Main Session" },
      { ...baseMeta, key: "sess-ops-1", agentId: "ops", title: "Ops One" },
      { ...baseMeta, key: "sess-ops-2", agentId: "ops", title: "Ops Two" },
    ];
    useChatStore.setState({
      sessionMetas: metas,
      sessionMeta: metas,
      activeAgentId: "main",
      activeSessionKey: "sess-main",
    });
    useAgentsStore.setState({
      agents: [
        { id: "main", name: "Main", model: "gpt-5.4", status: "idle" },
        { id: "ops", name: "Ops", model: "gpt-5.4", status: "idle" },
      ],
    });

    mountSidebar();

    expect(screen.getByRole("tab", { name: "All 3" }).getAttribute("aria-selected")).toBe("false");
    expect(screen.getByRole("tab", { name: "Main 1" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tab", { name: "Ops 2" }).getAttribute("aria-selected")).toBe("false");

    fireEvent.click(screen.getByRole("tab", { name: "Ops 2" }));
    expect(chatState.activeAgentId).toBe("ops");

    fireEvent.click(screen.getByRole("tab", { name: "All 3" }));
    expect(chatState.activeAgentId).toBeNull();
  });

  it("enters inline edit mode on double click", async () => {
    mountSidebar();

    await act(async () => {
      fireEvent.doubleClick(screen.getByText("Primary Session"));
    });

    expect(screen.getByDisplayValue("Primary Session")).toBeTruthy();
  });

  it("submits through blur on Enter and updates the title only after a successful patch", async () => {
    mountSidebar();

    await act(async () => {
      fireEvent.doubleClick(screen.getByText("Primary Session"));
    });
    const input = screen.getByDisplayValue("Primary Session");
    await act(async () => {
      fireEvent.change(input, { target: { value: "  Renamed Session  " } });
      fireEvent.keyDown(input, { key: "Enter" });
    });

    await waitFor(() => {
      expect(vi.mocked(patchSession)).toHaveBeenCalledWith({
        label: "Renamed Session",
        sessionKey: baseMeta.key,
      });
    });
    rerenderSidebar();
    expect(screen.getByText("Renamed Session")).toBeTruthy();
  });

  it("does not update the title when the patch fails", async () => {
    vi.mocked(patchSession).mockResolvedValueOnce({ ok: false, key: baseMeta.key });
    mountSidebar();

    await act(async () => {
      fireEvent.doubleClick(screen.getByText("Primary Session"));
    });
    const input = screen.getByDisplayValue("Primary Session");
    await act(async () => {
      fireEvent.change(input, { target: { value: "Rejected Rename" } });
      fireEvent.blur(input);
    });

    await waitFor(() => {
      expect(vi.mocked(patchSession)).toHaveBeenCalledWith({
        label: "Rejected Rename",
        sessionKey: baseMeta.key,
      });
    });
    rerenderSidebar();
    expect(screen.getByText("Primary Session")).toBeTruthy();
    expect(screen.queryByText("Rejected Rename")).toBeNull();
  });

  it("cancels editing on Escape without patching", () => {
    mountSidebar();

    act(() => {
      fireEvent.doubleClick(screen.getByText("Primary Session"));
    });
    const input = screen.getByDisplayValue("Primary Session");
    act(() => {
      fireEvent.change(input, { target: { value: "Cancelled Rename" } });
      fireEvent.keyDown(input, { key: "Escape" });
    });

    expect(vi.mocked(patchSession)).not.toHaveBeenCalled();
    rerenderSidebar();
    expect(screen.getByText("Primary Session")).toBeTruthy();
    expect(screen.queryByDisplayValue("Cancelled Rename")).toBeNull();
  });

  it("deletes a session through the Go chat-session alias and clears local state", async () => {
    chatState.sessions.set(baseMeta.key, { messages: [] });
    mountSidebar();

    const deleteButtons = screen.getAllByRole("button", { name: "Delete session" });
    await act(async () => {
      fireEvent.click(deleteButtons[0]);
    });

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Delete session" })).toBeTruthy();
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    });

    await waitFor(() => {
      expect(deleteSession).toHaveBeenCalledWith({
        agentId: "main",
        sessionKey: baseMeta.key,
      });
    });
    expect(setSessionMetas).toHaveBeenCalledWith([]);
    expect(removeSession).toHaveBeenCalledWith(baseMeta.key);
    expect(chatState.activeSessionKey).toBeNull();
    rerenderSidebar();
    expect(screen.queryByText("Primary Session")).toBeNull();
  });

  it("opens delete confirmation without selecting the row", async () => {
    useChatStore.setState({
      activeSessionKey: null,
      sessionMetas: [{ ...baseMeta }],
      sessionMeta: [{ ...baseMeta }],
    });
    mountSidebar();

    const deleteButton = screen.getByRole("button", { name: "Delete session" });
    await act(async () => {
      fireEvent.click(deleteButton);
    });

    expect(chatState.activeSessionKey).toBeNull();
    expect(screen.getByRole("dialog", { name: "Delete session" })).toBeTruthy();
  });
});

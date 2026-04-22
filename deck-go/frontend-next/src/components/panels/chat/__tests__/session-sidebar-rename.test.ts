// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) =>
    (
      ({
        defaultAgent: "Default agent",
        newSession: "New session",
        searchSessions: "Search sessions...",
      }) as const
    )[key as "defaultAgent" | "newSession" | "searchSessions"] ?? key,
}));

vi.mock("../chat-api", () => ({
  patchSession: vi.fn().mockResolvedValue(true),
  fetchSessionPreviews: vi.fn().mockResolvedValue({}),
}));

let SessionSidebar: typeof import("../SessionSidebar").SessionSidebar;
let useChatStore: typeof import("@/stores/chat").useChatStore;
let useAgentsStore: typeof import("@/stores/agents").useAgentsStore;
let patchSession: typeof import("../chat-api").patchSession;
let fetchSessionPreviews: typeof import("../chat-api").fetchSessionPreviews;

const baseMeta = {
  key: "agent:main:web-1712188800000-abc123",
  agentId: "main",
  title: "Primary Session",
  updatedAt: Date.now(),
};

beforeEach(async () => {
  vi.resetModules();
  ({ SessionSidebar } = await import("../SessionSidebar"));
  ({ useChatStore } = await import("@/stores/chat"));
  ({ useAgentsStore } = await import("@/stores/agents"));
  ({ patchSession } = await import("../chat-api"));
  ({ fetchSessionPreviews } = await import("../chat-api"));

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
    fetchAgents: vi.fn(async () => {}),
  });

  vi.mocked(patchSession).mockReset();
  vi.mocked(patchSession).mockResolvedValue(true);
  vi.mocked(fetchSessionPreviews).mockReset();
  vi.mocked(fetchSessionPreviews).mockResolvedValue({});
});

afterEach(() => {
  cleanup();
});

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

    render(createElement(SessionSidebar));

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

    render(createElement(SessionSidebar));

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

    render(createElement(SessionSidebar));

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

    render(createElement(SessionSidebar));

    await waitFor(() => {
      expect(screen.getByText("fallback preview")).toBeTruthy();
    });
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

    render(createElement(SessionSidebar));

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

  it("enters inline edit mode on double click", () => {
    render(createElement(SessionSidebar));

    fireEvent.doubleClick(screen.getByText("Primary Session"));

    expect(screen.getByDisplayValue("Primary Session")).toBeTruthy();
  });

  it("submits through blur on Enter and updates the title only after a successful patch", async () => {
    render(createElement(SessionSidebar));

    fireEvent.doubleClick(screen.getByText("Primary Session"));
    const input = screen.getByDisplayValue("Primary Session");
    fireEvent.change(input, { target: { value: "  Renamed Session  " } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(vi.mocked(patchSession)).toHaveBeenCalledWith(baseMeta.key, {
        label: "Renamed Session",
      });
    });
    await waitFor(() => {
      expect(screen.getByText("Renamed Session")).toBeTruthy();
    });
  });

  it("does not update the title when the patch fails", async () => {
    vi.mocked(patchSession).mockResolvedValueOnce(false);
    render(createElement(SessionSidebar));

    fireEvent.doubleClick(screen.getByText("Primary Session"));
    const input = screen.getByDisplayValue("Primary Session");
    fireEvent.change(input, { target: { value: "Rejected Rename" } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(vi.mocked(patchSession)).toHaveBeenCalledWith(baseMeta.key, {
        label: "Rejected Rename",
      });
    });
    expect(screen.getByText("Primary Session")).toBeTruthy();
    expect(screen.queryByText("Rejected Rename")).toBeNull();
  });

  it("cancels editing on Escape without patching", () => {
    render(createElement(SessionSidebar));

    fireEvent.doubleClick(screen.getByText("Primary Session"));
    const input = screen.getByDisplayValue("Primary Session");
    fireEvent.change(input, { target: { value: "Cancelled Rename" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(vi.mocked(patchSession)).not.toHaveBeenCalled();
    expect(screen.getByText("Primary Session")).toBeTruthy();
    expect(screen.queryByDisplayValue("Cancelled Rename")).toBeNull();
  });
});

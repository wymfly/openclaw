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
}));

let SessionSidebar: typeof import("../SessionSidebar").SessionSidebar;
let useChatStore: typeof import("@/stores/chat").useChatStore;
let useAgentsStore: typeof import("@/stores/agents").useAgentsStore;
let patchSession: typeof import("../chat-api").patchSession;

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

  const metas = [{ ...baseMeta }];
  useChatStore.setState({
    sessions: new Map(),
    activeAgentId: "main",
    activeSessionKey: baseMeta.key,
    sessionMetas: metas,
    sessionMeta: metas,
  });
  useAgentsStore.setState({
    agents: [{ id: "main", name: "Main", model: "gpt-5.4", status: "idle" }],
    fetchAgents: vi.fn(async () => {}),
  });

  vi.mocked(patchSession).mockReset();
  vi.mocked(patchSession).mockResolvedValue(true);
});

afterEach(() => {
  cleanup();
});

describe("SessionSidebar rename", () => {
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
    expect(screen.getByRole("button", { name: "Primary Session" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ops Review" })).toBeTruthy();

    fireEvent.change(searchInput, { target: { value: "ops" } });

    expect(screen.queryByRole("button", { name: "Primary Session" })).toBeNull();
    expect(screen.getByRole("button", { name: "Ops Review" })).toBeTruthy();

    fireEvent.change(searchInput, { target: { value: "" } });

    expect(screen.getByRole("button", { name: "Primary Session" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ops Review" })).toBeTruthy();
  });

  it("enters inline edit mode on double click", () => {
    render(createElement(SessionSidebar));

    fireEvent.doubleClick(screen.getByRole("button", { name: "Primary Session" }));

    expect(screen.getByDisplayValue("Primary Session")).toBeTruthy();
  });

  it("submits through blur on Enter and updates the title only after a successful patch", async () => {
    render(createElement(SessionSidebar));

    fireEvent.doubleClick(screen.getByRole("button", { name: "Primary Session" }));
    const input = screen.getByDisplayValue("Primary Session");
    fireEvent.change(input, { target: { value: "  Renamed Session  " } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(vi.mocked(patchSession)).toHaveBeenCalledWith(baseMeta.key, {
        label: "Renamed Session",
      });
    });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Renamed Session" })).toBeTruthy();
    });
  });

  it("does not update the title when the patch fails", async () => {
    vi.mocked(patchSession).mockResolvedValueOnce(false);
    render(createElement(SessionSidebar));

    fireEvent.doubleClick(screen.getByRole("button", { name: "Primary Session" }));
    const input = screen.getByDisplayValue("Primary Session");
    fireEvent.change(input, { target: { value: "Rejected Rename" } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(vi.mocked(patchSession)).toHaveBeenCalledWith(baseMeta.key, {
        label: "Rejected Rename",
      });
    });
    expect(screen.getByRole("button", { name: "Primary Session" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Rejected Rename" })).toBeNull();
  });

  it("cancels editing on Escape without patching", () => {
    render(createElement(SessionSidebar));

    fireEvent.doubleClick(screen.getByRole("button", { name: "Primary Session" }));
    const input = screen.getByDisplayValue("Primary Session");
    fireEvent.change(input, { target: { value: "Cancelled Rename" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(vi.mocked(patchSession)).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Primary Session" })).toBeTruthy();
    expect(screen.queryByDisplayValue("Cancelled Rename")).toBeNull();
  });
});

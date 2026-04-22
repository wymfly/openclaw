// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, string>) =>
    (
      ({
        title: "Thread Bindings",
        diagnosticsDescription: "Inspect how each thread is routed to a session and agent.",
        channel: "Channel",
        agent: "Agent",
        threadId: "Label",
        kind: "Kind",
        boundAt: "Bound",
        lastActivity: "Last Activity",
        account: "Account",
        boundBy: "Bound By",
        targetKind: "Target Kind",
        targetSession: "Target Session",
        targetAgent: "Target Agent",
        selectThreadTitle: "Select a thread",
        selectThreadDescription:
          "Pick a thread binding to inspect its routing and target relationships.",
        relationTitle: "Routing Relationship",
        relationDescription:
          "This view explains how the platform thread is bound to the OpenClaw session and agent.",
        bindingExplanation: `This thread is routed as \`${values?.kind}\` and was bound by \`${values?.boundBy}\`.`,
        filterAgent: "Filter by agent",
        filterChannel: "Filter by channel",
        statusActive: "Active",
        statusAll: "All",
        noThreads: "No thread bindings found",
        loading: "Loading",
        justNow: "just now",
        secondsAgo: "{n}s ago",
        minutesAgo: "{n}m ago",
        hoursAgo: "{n}h ago",
        daysAgo: "{n}d ago",
        copySessionKey: "Copy Session Key",
        openSession: "Open Session",
        openAgent: "Open Agent",
        thread: "Thread",
      }) as Record<string, string>
    )[key] ?? key,
}));

vi.mock("@/components/shared/AgentBadge", () => ({
  AgentBadge: ({ agentId }: { agentId: string }) => <span>{agentId}</span>,
}));

vi.mock("@/lib/panel-navigation", () => ({
  navigateToAgent: vi.fn(),
  navigateToSession: vi.fn(),
}));

let ThreadsPanel: typeof import("./ThreadsPanel").ThreadsPanel;
let useThreadsStore: typeof import("@/stores/deck-threads").useThreadsStore;

beforeEach(async () => {
  vi.resetModules();
  ({ ThreadsPanel } = await import("./ThreadsPanel"));
  ({ useThreadsStore } = await import("@/stores/deck-threads"));

  const now = Date.now();
  useThreadsStore.setState({
    threads: [
      {
        threadId: "thread-1",
        label: "Discord Thread",
        channelId: "discord",
        accountId: "main-account",
        agentId: "main",
        targetSessionKey: "agent:main:discord:channel:1:thread:thread-1",
        targetKind: "session",
        boundBy: "direct-binding",
        boundAt: now - 60_000,
        lastActivityAt: now - 10_000,
      },
    ],
    loading: false,
    error: null,
    selectedThreadId: "thread-1",
    filterAgent: "",
    filterChannel: "",
    filterStatus: "active",
    fetchThreads: vi.fn(async () => {}),
    selectThread: vi.fn((threadId: string | null) =>
      useThreadsStore.setState({ selectedThreadId: threadId }),
    ),
    setFilterAgent: vi.fn(),
    setFilterChannel: vi.fn(),
    setFilterStatus: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ThreadsPanel", () => {
  it("renders list, detail, and explanatory relation view", () => {
    render(createElement(ThreadsPanel));

    expect(screen.getByText("Thread Bindings")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Discord Thread/ })).toBeTruthy();
    expect(screen.getByText("Routing Relationship")).toBeTruthy();
    expect(
      screen.getAllByText("agent:main:discord:channel:1:thread:thread-1").length,
    ).toBeGreaterThan(0);
  });

  it("updates detail when a different thread row is selected", () => {
    const now = Date.now();
    useThreadsStore.setState({
      threads: [
        ...useThreadsStore.getState().threads,
        {
          threadId: "thread-2",
          label: "Forum Topic",
          channelId: "telegram",
          accountId: "bot-2",
          agentId: "ops",
          targetSessionKey: "agent:ops:telegram:group:2:topic:thread-2",
          targetKind: "session",
          boundBy: "parent-inheritance",
          boundAt: now - 120_000,
          lastActivityAt: now - 5_000,
        },
      ],
    });

    render(createElement(ThreadsPanel));

    fireEvent.click(screen.getByRole("button", { name: /Forum Topic/ }));

    expect(screen.getByRole("heading", { name: "Forum Topic" })).toBeTruthy();
    expect(
      screen.getByText(
        /This thread is routed as `session` and was bound by `parent-inheritance`\./,
      ),
    ).toBeTruthy();
  });
});

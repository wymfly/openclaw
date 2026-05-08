// @vitest-environment jsdom
import { QueryClient } from "@tanstack/react-query";
import { act, createElement, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DataFabricProvider } from "../client/scoped-query-provider";
import { dataFreshnessPolicies } from "../contracts/freshness";
import { executeBffQuerySource } from "../transport/bff";
import { chatKeys } from "./chat/keys";
import { useSessionEventsSubscriptionMutation } from "./chat/mutations";
import { applyChatSessionInvalidation } from "./chat/projections";
import { chatSnapshotQueryOptions } from "./chat/queries";
import { commandsKeys } from "./commands/keys";
import { applyCommandDiscoveryInvalidation } from "./commands/projections";
import { commandDiscoveryQueryOptions } from "./commands/queries";
import { sessionsKeys } from "./sessions/keys";
import { sessionPreviewsQueryOptions } from "./sessions/queries";

const apiMocks = vi.hoisted(() => ({
  fetchChatSnapshot: vi.fn(),
  fetchCommandDiscovery: vi.fn(),
  fetchSessionPreviews: vi.fn(),
  setSessionEventsSubscription: vi.fn(),
}));

vi.mock("@/api", () => apiMocks);

type MutationHandles = {
  sessionEvents: ReturnType<typeof useSessionEventsSubscriptionMutation>;
};

let container: HTMLDivElement;
let root: Root | null = null;
let queryClient: QueryClient;
let handles: MutationHandles | null = null;

function MutationProbe({ onReady }: { onReady: (handles: MutationHandles) => void }) {
  const sessionEvents = useSessionEventsSubscriptionMutation();

  useEffect(() => {
    onReady({ sessionEvents });
  }, [onReady, sessionEvents]);

  return null;
}

async function renderMutationProbe() {
  await act(async () => {
    root = createRoot(container);
    root.render(
      createElement(
        DataFabricProvider,
        { queryClient },
        createElement(MutationProbe, {
          onReady(next) {
            handles = next;
          },
        }),
      ),
    );
  });
  if (!handles) {
    throw new Error("mutation handles did not initialize");
  }
  return handles;
}

describe("chat surroundings Data Fabric modules", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
    });
    handles = null;
    vi.clearAllMocks();
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

  it("exposes stable serializable keys for chat and command surroundings", () => {
    const keys = [
      chatKeys.snapshot({ agentId: "main", limit: 20, sessionKey: "sess-1" }),
      chatKeys.sessionEvents("sess-1"),
      commandsKeys.discovery("main"),
      sessionsKeys.previews(["b", "a"]),
    ];

    for (const key of keys) {
      expect(() => JSON.stringify(key)).not.toThrow();
      expect(JSON.parse(JSON.stringify(key))[0]).toBe("deck-go");
    }
  });

  it("maps surrounding reads to contract-derived freshness tiers", () => {
    expect(
      chatSnapshotQueryOptions(executeBffQuerySource, {
        agentId: "main",
        sessionKey: "sess-1",
      }).staleTime,
    ).toBe(dataFreshnessPolicies["stream-driven"].staleTime);
    expect(commandDiscoveryQueryOptions(executeBffQuerySource, "main").staleTime).toBe(
      dataFreshnessPolicies.inventory.staleTime,
    );
    expect(sessionPreviewsQueryOptions(executeBffQuerySource, ["sess-1"]).staleTime).toBe(
      dataFreshnessPolicies["lazy-detail"].staleTime,
    );
  });

  it("reuses fresh cache and preserves cached snapshot data after refresh failure", async () => {
    apiMocks.fetchChatSnapshot.mockResolvedValueOnce({
      activeApproval: null,
      a2uiState: null,
      messages: [{ content: "hello", role: "user" }],
      session: { agentId: "main", key: "sess-1", updatedAt: 1 },
    });

    const options = chatSnapshotQueryOptions(executeBffQuerySource, {
      agentId: "main",
      sessionKey: "sess-1",
    });
    const first = await queryClient.fetchQuery(options);
    const second = await queryClient.fetchQuery(options);

    expect(first).toBe(second);
    expect(apiMocks.fetchChatSnapshot).toHaveBeenCalledTimes(1);

    apiMocks.fetchChatSnapshot.mockRejectedValueOnce(new Error("refresh failed"));
    await queryClient.invalidateQueries({ queryKey: chatKeys.snapshot({ sessionKey: "sess-1" }) });
    await queryClient
      .fetchQuery({
        ...options,
        staleTime: 0,
      })
      .catch(() => {});

    expect(queryClient.getQueryData(options.queryKey)).toBe(first);
  });

  it("fetches command discovery through the API facade and invalidates on command events", async () => {
    apiMocks.fetchCommandDiscovery.mockResolvedValueOnce({
      commands: [{ description: "Show status", name: "status", source: "builtin" }],
      version: "v1",
    });
    const options = commandDiscoveryQueryOptions(executeBffQuerySource, "main");

    await expect(queryClient.fetchQuery(options)).resolves.toMatchObject({
      version: "v1",
    });
    expect(apiMocks.fetchCommandDiscovery).toHaveBeenCalledWith("main");
    expect(queryClient.getQueryState(options.queryKey)?.isInvalidated).toBe(false);

    await applyCommandDiscoveryInvalidation(
      queryClient,
      {
        event: "commands.changed",
        projectionId: "command-discovery",
      },
      "main",
    );

    expect(queryClient.getQueryState(options.queryKey)?.isInvalidated).toBe(true);
  });

  it("invalidates chat and session keys for chat-session projection events", async () => {
    const snapshotKey = chatKeys.snapshot({ sessionKey: "sess-1" });
    const listKey = sessionsKeys.list();
    queryClient.setQueryData(snapshotKey, { messages: [] });
    queryClient.setQueryData(listKey, { sessions: [] });

    await applyChatSessionInvalidation(queryClient, {
      event: "projection.gap",
      projectionId: "chat-session",
      sessionKey: "sess-1",
    });

    expect(queryClient.getQueryState(snapshotKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(listKey)?.isInvalidated).toBe(true);
  });

  it("wraps session event subscriptions in a no-retry mutation", async () => {
    apiMocks.setSessionEventsSubscription.mockResolvedValueOnce({ ok: true });
    const mutationHandles = await renderMutationProbe();

    await act(async () => {
      await mutationHandles.sessionEvents.mutateAsync({
        action: "subscribe",
        sessionKey: "sess-1",
      });
    });

    expect(apiMocks.setSessionEventsSubscription).toHaveBeenCalledWith({
      action: "subscribe",
      sessionKey: "sess-1",
    });
  });
});

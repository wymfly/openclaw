// @vitest-environment jsdom
import { QueryClient } from "@tanstack/react-query";
import { act, createElement, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DataFabricProvider } from "../client/scoped-query-provider";
import { dataFreshnessPolicies } from "../contracts/freshness";
import { runtimeCapabilitiesQueryOptions } from "../queries/capabilities";
import { executeBffQuerySource } from "../transport/bff";
import { agentsKeys } from "./agents/keys";
import { gatewayDescribeQueryOptions } from "./gateway/queries";
import { identityKeys } from "./identity/keys";
import { useLinkIdentityPeerMutation, useUnlinkIdentityPeerMutation } from "./identity/mutations";
import { identityLinksQueryOptions } from "./identity/queries";
import { subagentsKeys } from "./subagents/keys";
import { useKillSubagentRunMutation, useSteerSubagentRunMutation } from "./subagents/mutations";
import { subagentLineageQueryOptions, subagentRunsQueryOptions } from "./subagents/queries";

const apiMocks = vi.hoisted(() => ({
  fetchCapabilities: vi.fn(),
  fetchGatewayDescribe: vi.fn(),
  fetchIdentityLinks: vi.fn(),
  fetchSubagentLineage: vi.fn(),
  fetchSubagentRuns: vi.fn(),
  killSubagentRun: vi.fn(),
  linkIdentityPeer: vi.fn(),
  steerSubagentRun: vi.fn(),
  unlinkIdentityPeer: vi.fn(),
}));

vi.mock("@/api", () => apiMocks);

type MutationHandles = {
  killSubagent: ReturnType<typeof useKillSubagentRunMutation>;
  linkIdentity: ReturnType<typeof useLinkIdentityPeerMutation>;
  steerSubagent: ReturnType<typeof useSteerSubagentRunMutation>;
  unlinkIdentity: ReturnType<typeof useUnlinkIdentityPeerMutation>;
};

let container: HTMLDivElement;
let queryClient: QueryClient;
let root: Root | null = null;
let handles: MutationHandles | null = null;

function MutationProbe({ onReady }: { onReady: (handles: MutationHandles) => void }) {
  const linkIdentity = useLinkIdentityPeerMutation();
  const unlinkIdentity = useUnlinkIdentityPeerMutation();
  const killSubagent = useKillSubagentRunMutation();
  const steerSubagent = useSteerSubagentRunMutation();

  useEffect(() => {
    onReady({ killSubagent, linkIdentity, steerSubagent, unlinkIdentity });
  }, [killSubagent, linkIdentity, onReady, steerSubagent, unlinkIdentity]);

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

describe("Data Fabric governance sweep modules", () => {
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

  it("exposes stable keys for capabilities, identity, subagents, and gateway describe", () => {
    const keys = [
      runtimeCapabilitiesQueryOptions(executeBffQuerySource).queryKey,
      identityKeys.links(),
      subagentsKeys.runs({ limit: 100, status: "all" }),
      subagentsKeys.lineage({ runId: "run-1" }),
      subagentsKeys.lineage({ sessionKey: "sess-1" }),
      agentsKeys.subagents("main"),
    ];

    for (const key of keys) {
      expect(() => JSON.stringify(key)).not.toThrow();
      expect(JSON.parse(JSON.stringify(key))[0]).toBe("deck-go");
    }
  });

  it("maps residual reads to the accepted freshness tiers", () => {
    expect(runtimeCapabilitiesQueryOptions(executeBffQuerySource).staleTime).toBe(
      dataFreshnessPolicies["runtime-liveness"].staleTime,
    );
    expect(gatewayDescribeQueryOptions(executeBffQuerySource).staleTime).toBe(
      dataFreshnessPolicies["lazy-detail"].staleTime,
    );
    expect(identityLinksQueryOptions(executeBffQuerySource).staleTime).toBe(
      dataFreshnessPolicies["config-authority"].staleTime,
    );
    expect(subagentRunsQueryOptions(executeBffQuerySource).staleTime).toBe(
      dataFreshnessPolicies["live-workbench"].staleTime,
    );
    expect(subagentLineageQueryOptions(executeBffQuerySource, { runId: "run-1" }).staleTime).toBe(
      dataFreshnessPolicies["lazy-detail"].staleTime,
    );
  });

  it("fetches residual reads through Data Fabric query options", async () => {
    apiMocks.fetchCapabilities.mockResolvedValueOnce({ mode: "bundled", configured: true });
    apiMocks.fetchIdentityLinks.mockResolvedValueOnce({ configHash: "hash-1", links: [] });
    apiMocks.fetchSubagentRuns.mockResolvedValueOnce({ runs: [], total: 0 });
    apiMocks.fetchSubagentLineage.mockResolvedValueOnce({
      nodes: [],
      root: { agentId: "main", sessionKey: "sess-1" },
    });

    await queryClient.fetchQuery(runtimeCapabilitiesQueryOptions(executeBffQuerySource));
    await queryClient.fetchQuery(identityLinksQueryOptions(executeBffQuerySource));
    await queryClient.fetchQuery(subagentRunsQueryOptions(executeBffQuerySource));
    await queryClient.fetchQuery(
      subagentLineageQueryOptions(executeBffQuerySource, { runId: "run-1" }),
    );

    expect(apiMocks.fetchCapabilities).toHaveBeenCalledTimes(1);
    expect(apiMocks.fetchIdentityLinks).toHaveBeenCalledTimes(1);
    expect(apiMocks.fetchSubagentRuns).toHaveBeenCalledWith({});
    expect(apiMocks.fetchSubagentLineage).toHaveBeenCalledWith({ runId: "run-1" });
  });

  it("wraps identity mutations with base-hash safety and invalidation", async () => {
    const mutationHandles = await renderMutationProbe();
    apiMocks.linkIdentityPeer.mockResolvedValueOnce({ ok: true });
    apiMocks.unlinkIdentityPeer.mockResolvedValueOnce({ ok: true });
    queryClient.setQueryData(identityKeys.links(), { links: [] });

    await act(async () => {
      await mutationHandles.linkIdentity.mutateAsync({
        baseHash: "hash-1",
        canonical: "main",
        channel: "telegram",
        peerId: "tg-main",
      });
    });

    expect(apiMocks.linkIdentityPeer).toHaveBeenCalledWith("main", "telegram", "tg-main", "hash-1");
    expect(queryClient.getQueryState(identityKeys.links())?.isInvalidated).toBe(true);

    await act(async () => {
      await mutationHandles.unlinkIdentity.mutateAsync({
        baseHash: "hash-1",
        canonical: "main",
        channel: "telegram",
        peerId: "tg-main",
      });
    });

    expect(apiMocks.unlinkIdentityPeer).toHaveBeenCalledWith(
      "main",
      "telegram",
      "tg-main",
      "hash-1",
    );
  });

  it("wraps subagent actions and invalidates run/lineage read models", async () => {
    const mutationHandles = await renderMutationProbe();
    apiMocks.killSubagentRun.mockResolvedValueOnce({ ok: true, runId: "run-1" });
    apiMocks.steerSubagentRun.mockResolvedValueOnce({ success: true });
    queryClient.setQueryData(subagentsKeys.runs(), { runs: [], total: 0 });

    await act(async () => {
      await mutationHandles.killSubagent.mutateAsync("run-1");
    });
    await act(async () => {
      await mutationHandles.steerSubagent.mutateAsync({
        instruction: "continue",
        runId: "run-1",
      });
    });

    expect(apiMocks.killSubagentRun).toHaveBeenCalledWith("run-1");
    expect(apiMocks.steerSubagentRun).toHaveBeenCalledWith("run-1", "continue");
    expect(queryClient.getQueryState(subagentsKeys.runs())?.isInvalidated).toBe(true);
  });
});

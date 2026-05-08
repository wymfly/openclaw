// @vitest-environment jsdom
import { QueryClient } from "@tanstack/react-query";
import { act, createElement, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DataFabricProvider } from "../client/scoped-query-provider";
import { dataFreshnessPolicies } from "../contracts/freshness";
import { executeBffQuerySource } from "../transport/bff";
import { channelsKeys } from "./channels/keys";
import { usePatchChannelConfigMutation } from "./channels/mutations";
import { channelThroughputQueryOptions, channelsListQueryOptions } from "./channels/queries";
import { configKeys } from "./config/keys";
import { configLookupQueryOptions, configSnapshotQueryOptions } from "./config/queries";
import { docsKeys } from "./docs/keys";
import { docsListQueryOptions } from "./docs/queries";
import { memoryHealthQueryOptions } from "./memory/queries";
import { modelsConfigQueryOptions, modelUsageCostQueryOptions } from "./models/queries";
import { nodesKeys } from "./nodes/keys";
import { pluginsKeys } from "./plugins/keys";
import { routingKeys } from "./routing/keys";
import { useAddRoutingBindingMutation } from "./routing/mutations";
import { routingActivityQueryOptions, routingBindingsQueryOptions } from "./routing/queries";
import { settingsKeys } from "./settings/keys";
import { applyDevicePairingInvalidation } from "./settings/projections";
import { settingsQueryOptions } from "./settings/queries";
import { DataFabricBaseHashRequiredError } from "./shared";
import { skillsKeys } from "./skills/keys";

const apiMocks = vi.hoisted(() => ({
  addRoutingBinding: vi.fn(),
  fetchChannelThroughput: vi.fn(),
  fetchChannels: vi.fn(),
  fetchDeckConfig: vi.fn(),
  fetchDocs: vi.fn(),
  fetchMemoryHealth: vi.fn(),
  fetchModelsConfig: vi.fn(),
  fetchModelUsageCost: vi.fn(),
  fetchRoutingBindings: vi.fn(),
  fetchSettings: vi.fn(),
  lookupConfigPath: vi.fn(),
  patchChannelConfig: vi.fn(),
}));

vi.mock("@/api", () => apiMocks);

type MutationHandles = {
  addRouting: ReturnType<typeof useAddRoutingBindingMutation>;
  patchChannel: ReturnType<typeof usePatchChannelConfigMutation>;
};

let container: HTMLDivElement;
let root: Root | null = null;
let queryClient: QueryClient;
let handles: MutationHandles | null = null;

function MutationProbe({ onReady }: { onReady: (handles: MutationHandles) => void }) {
  const addRouting = useAddRoutingBindingMutation();
  const patchChannel = usePatchChannelConfigMutation();

  useEffect(() => {
    onReady({ addRouting, patchChannel });
  }, [addRouting, onReady, patchChannel]);

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

describe("config/inventory Data Fabric modules", () => {
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

  it("exposes stable serializable keys for every scoped config/inventory module", () => {
    const keys = [
      skillsKeys.list({ agentId: "main" }),
      skillsKeys.hubDetail("git-helper"),
      channelsKeys.list(),
      channelsKeys.throughput("telegram", "1h"),
      configKeys.snapshot(),
      configKeys.lookup("agents"),
      docsKeys.list({ query: "api" }),
      docsKeys.detail("doc-1"),
      nodesKeys.list(),
      nodesKeys.pairing(),
      pluginsKeys.list("channel"),
      routingKeys.bindings({ accountId: "acct", channel: "wecom" }),
      routingKeys.activity(20),
      settingsKeys.settings(),
      settingsKeys.devices(),
    ];

    for (const key of keys) {
      expect(() => JSON.stringify(key)).not.toThrow();
      expect(JSON.parse(JSON.stringify(key))[0]).toBe("deck-go");
    }
  });

  it("maps representative reads to contract-derived freshness tiers", () => {
    expect(channelsListQueryOptions(executeBffQuerySource).staleTime).toBe(
      dataFreshnessPolicies["config-authority"].staleTime,
    );
    expect(channelThroughputQueryOptions(executeBffQuerySource, "telegram").staleTime).toBe(
      dataFreshnessPolicies["live-workbench"].staleTime,
    );
    expect(configSnapshotQueryOptions(executeBffQuerySource).staleTime).toBe(
      dataFreshnessPolicies["config-authority"].staleTime,
    );
    expect(configLookupQueryOptions(executeBffQuerySource, "").staleTime).toBe(
      dataFreshnessPolicies["lazy-detail"].staleTime,
    );
    expect(modelsConfigQueryOptions(executeBffQuerySource).staleTime).toBe(
      dataFreshnessPolicies["config-authority"].staleTime,
    );
    expect(modelUsageCostQueryOptions(executeBffQuerySource, 14).staleTime).toBe(
      dataFreshnessPolicies.historical.staleTime,
    );
    expect(memoryHealthQueryOptions(executeBffQuerySource).staleTime).toBe(
      dataFreshnessPolicies["lazy-detail"].staleTime,
    );
    expect(routingActivityQueryOptions(executeBffQuerySource, 20).staleTime).toBe(
      dataFreshnessPolicies.historical.staleTime,
    );
    expect(settingsQueryOptions(executeBffQuerySource).staleTime).toBe(
      dataFreshnessPolicies["config-authority"].staleTime,
    );
  });

  it("reuses the same routing binding source for routing and channel child views", () => {
    const filters = { accountId: "default", channel: "wecom" };
    const routingOptions = routingBindingsQueryOptions(executeBffQuerySource, filters);
    const channelChildOptions = routingBindingsQueryOptions(executeBffQuerySource, filters);

    expect(routingOptions.queryKey).toEqual(channelChildOptions.queryKey);
    expect(routingOptions.queryKey).toEqual(routingKeys.bindings(filters));
  });

  it("returns fresh cache and preserves cached data after a background refresh error", async () => {
    apiMocks.fetchDocs.mockResolvedValueOnce({ docs: [{ id: "doc-1", title: "Cached" }] });
    await queryClient.fetchQuery(docsListQueryOptions(executeBffQuerySource));
    await queryClient.fetchQuery(docsListQueryOptions(executeBffQuerySource));
    expect(apiMocks.fetchDocs).toHaveBeenCalledTimes(1);

    apiMocks.fetchDocs.mockRejectedValueOnce(new Error("docs unavailable"));
    await queryClient.refetchQueries({ queryKey: docsKeys.list() });

    expect(queryClient.getQueryData(docsKeys.list())).toEqual({
      docs: [{ id: "doc-1", title: "Cached" }],
    });
    expect(apiMocks.fetchDocs).toHaveBeenCalledTimes(2);
  });

  it("blocks client-required routing mutations before backend calls and invalidates on safe writes", async () => {
    const mutations = await renderMutationProbe();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    await expect(
      mutations.addRouting.mutateAsync({
        agentId: "main",
        baseHash: "",
        match: { channel: "telegram" },
      }),
    ).rejects.toBeInstanceOf(DataFabricBaseHashRequiredError);
    expect(apiMocks.addRoutingBinding).not.toHaveBeenCalled();

    apiMocks.patchChannelConfig.mockResolvedValue({ ok: true });
    await mutations.patchChannel.mutateAsync({
      channelId: "telegram",
      patch: { enabled: false },
    });

    expect(apiMocks.patchChannelConfig).toHaveBeenCalledWith("telegram", { enabled: false });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: channelsKeys.all() });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: channelsKeys.throughput("telegram") });
  });

  it("invalidates settings device queries for supported device-pairing projection events", async () => {
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    await applyDevicePairingInvalidation(queryClient, {
      projection: "device-pairing",
      type: "device.pair.requested",
    });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: settingsKeys.devices() });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: settingsKeys.selfDevice() });

    invalidate.mockClear();
    await applyDevicePairingInvalidation(queryClient, {
      projection: "routing-bindings",
      type: "device.pair.requested",
    });
    expect(invalidate).not.toHaveBeenCalled();
  });
});

// @vitest-environment jsdom
import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDataFabricQueryClient } from "../../client/query-client";
import { executeBffQuerySource, type DataFabricBffTransport } from "../../transport/bff";
import type { DataFabricGatewayRpcTransport } from "../../transport/gateway-rpc";
import { agentsKeys } from "./keys";
import { agentsListQueryOptions, agentSkillsQueryOptions } from "./queries";

const apiMocks = vi.hoisted(() => ({
  fetchAgentSkills: vi.fn(),
  fetchAgentsList: vi.fn(),
}));

vi.mock("@/api", () => apiMocks);

const gatewayRpc: DataFabricGatewayRpcTransport = (source, signal) =>
  source.request({} as never, signal);

describe("Agents Data Fabric queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("wraps the Agents list facade and shares fresh cache results", async () => {
    const queryClient = createDataFabricQueryClient();
    apiMocks.fetchAgentsList.mockResolvedValue({
      agents: [{ id: "main", name: "Main", status: "idle", isDefault: true }],
    });

    await queryClient.fetchQuery(agentsListQueryOptions(gatewayRpc));
    await queryClient.fetchQuery(agentsListQueryOptions(gatewayRpc));

    expect(apiMocks.fetchAgentsList).toHaveBeenCalledTimes(1);
  });

  it("keeps cached Agents list data after a failed background refetch", async () => {
    const queryClient = createDataFabricQueryClient();
    const cached = {
      agents: [{ id: "main", name: "Main", status: "idle", isDefault: true }],
    };
    apiMocks.fetchAgentsList.mockResolvedValueOnce(cached);

    await queryClient.fetchQuery(agentsListQueryOptions(gatewayRpc));
    apiMocks.fetchAgentsList.mockRejectedValueOnce(new Error("runtime unavailable"));
    await queryClient.invalidateQueries({ queryKey: agentsKeys.list() });
    await queryClient.refetchQueries({ queryKey: agentsKeys.list() });

    expect(apiMocks.fetchAgentsList).toHaveBeenCalledTimes(2);
    expect(queryClient.getQueryData(agentsKeys.list())).toEqual(cached);
  });

  it("wraps BFF child facades through BFF query sources", async () => {
    const calls: string[] = [];
    const bff: DataFabricBffTransport = (source, signal) => {
      calls.push(source.path);
      return executeBffQuerySource(source, signal) as never;
    };
    const queryClient = new QueryClient();
    apiMocks.fetchAgentSkills.mockResolvedValue({
      available: [],
      configHash: "hash-1",
      mode: "all",
      skills: [],
    });

    await queryClient.fetchQuery(agentSkillsQueryOptions(bff, "main"));

    expect(apiMocks.fetchAgentSkills).toHaveBeenCalledWith("main");
    expect(calls).toEqual(["POST /deck/agents"]);
  });
});

import { describe, expect, it } from "vitest";
import { dataFreshnessPolicies } from "../../contracts/freshness";
import type { DataFabricBffTransport } from "../../transport/bff";
import type { DataFabricGatewayRpcTransport } from "../../transport/gateway-rpc";
import { agentsKeys } from "./keys";
import {
  agentDetailQueryOptions,
  agentEventStreamsQueryOptions,
  agentFilesQueryOptions,
  agentHealthQueryOptions,
  agentModelPolicyQueryOptions,
  agentSkillsQueryOptions,
  agentsConfiguredModelsQueryOptions,
  agentsListQueryOptions,
  agentSubagentsQueryOptions,
  agentSystemPromptQueryOptions,
  agentToolPolicyQueryOptions,
} from "./queries";

const noopBff: DataFabricBffTransport = async () => ({}) as never;
const noopGatewayRpc: DataFabricGatewayRpcTransport = async () => ({}) as never;

describe("Agents Data Fabric keys", () => {
  it("uses stable serializable keys for list and child read models", () => {
    const keys = [
      agentsKeys.list(),
      agentsKeys.configuredModels(),
      agentsKeys.detail("main"),
      agentsKeys.health(),
      agentsKeys.skills("main"),
      agentsKeys.subagents("main"),
      agentsKeys.modelPolicy("main"),
      agentsKeys.modelPolicy(),
      agentsKeys.eventStreams("main"),
      agentsKeys.toolPolicy("main"),
      agentsKeys.systemPrompt("main"),
      agentsKeys.files("main"),
      agentsKeys.file("main", "AGENTS.md"),
      agentsKeys.identity("main"),
    ];

    for (const key of keys) {
      expect(() => JSON.stringify(key)).not.toThrow();
      expect(JSON.parse(JSON.stringify(key))[0]).toBe("deck-go");
    }
  });

  it("maps every Agents read to its contract-derived freshness tier", () => {
    expect(agentsListQueryOptions(noopGatewayRpc).staleTime).toBe(
      dataFreshnessPolicies.inventory.staleTime,
    );
    expect(agentsConfiguredModelsQueryOptions(noopGatewayRpc).staleTime).toBe(
      dataFreshnessPolicies.inventory.staleTime,
    );
    expect(agentHealthQueryOptions(noopBff).staleTime).toBe(
      dataFreshnessPolicies["live-workbench"].staleTime,
    );
    expect(agentSkillsQueryOptions(noopBff, "main").staleTime).toBe(
      dataFreshnessPolicies["config-authority"].staleTime,
    );
    expect(agentSubagentsQueryOptions(noopBff, "main").staleTime).toBe(
      dataFreshnessPolicies["config-authority"].staleTime,
    );
    expect(agentModelPolicyQueryOptions(noopBff, "main").staleTime).toBe(
      dataFreshnessPolicies["config-authority"].staleTime,
    );
    expect(agentEventStreamsQueryOptions(noopBff, "main").staleTime).toBe(
      dataFreshnessPolicies["config-authority"].staleTime,
    );
    expect(agentDetailQueryOptions(noopBff, "main").staleTime).toBe(
      dataFreshnessPolicies["lazy-detail"].staleTime,
    );
    expect(agentToolPolicyQueryOptions(noopBff, "main").staleTime).toBe(
      dataFreshnessPolicies["lazy-detail"].staleTime,
    );
    expect(agentSystemPromptQueryOptions(noopBff, "main").staleTime).toBe(
      dataFreshnessPolicies["lazy-detail"].staleTime,
    );
    expect(agentFilesQueryOptions(noopBff, "main").staleTime).toBe(
      dataFreshnessPolicies["lazy-detail"].staleTime,
    );
  });
});

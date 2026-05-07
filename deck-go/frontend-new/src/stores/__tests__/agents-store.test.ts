import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DeckGoServerEvent } from "@/api-types";
import { readAgentMetricsAction, reduceAgentMetricsEvent } from "../agents-metrics";

let useAgentsStore: typeof import("../agents").useAgentsStore;
let normalizeAgentSummary: typeof import("../agents").normalizeAgentSummary;

beforeEach(async () => {
  vi.resetModules();
  ({ useAgentsStore, normalizeAgentSummary } = await import("../agents"));
  useAgentsStore.getState().reset();
});

describe("agents store", () => {
  it("normalizes agent summary defaults without inventing counters", () => {
    expect(
      normalizeAgentSummary({
        id: "main",
        name: "",
        model: "gpt-5.4",
        status: "busy",
      }),
    ).toMatchObject({
      id: "main",
      name: "main",
      model: "gpt-5.4",
      status: "busy",
      isDefault: false,
    });
  });

  it("loads agents without auto-opening a detail row", async () => {
    await useAgentsStore.getState().loadAgents(async () => ({
      defaultId: "ops",
      agents: [
        {
          id: "main",
          name: "Main",
          status: "idle",
          isDefault: false,
          isConfiguredDefault: false,
          isMainProtected: true,
        },
        {
          id: "ops",
          name: "Ops",
          status: "busy",
          isDefault: true,
          isConfiguredDefault: true,
          isMainProtected: false,
        },
      ],
    }));

    expect(useAgentsStore.getState()).toMatchObject({
      status: "ready",
      selectedAgentId: null,
      error: null,
    });
  });

  it("falls back to a remaining row after delete", () => {
    useAgentsStore.getState().setAgents([
      { id: "main", name: "Main", status: "idle", isDefault: true },
      { id: "ops", name: "Ops", status: "idle", isDefault: false },
    ]);
    useAgentsStore.getState().selectAgent("main");

    useAgentsStore.getState().removeAgent("main");

    expect(useAgentsStore.getState().agents.map((agent) => agent.id)).toEqual(["ops"]);
    expect(useAgentsStore.getState().selectedAgentId).toBe("ops");
  });

  it("keeps the list view selected while live events update agents", () => {
    useAgentsStore.getState().setAgents([
      { id: "main", name: "Main", status: "idle", isDefault: true },
      { id: "ops", name: "Ops", status: "idle", isDefault: false },
    ]);
    useAgentsStore.getState().selectAgent(null);

    useAgentsStore.getState().applyServerEvent({
      event: "agent.status.changed",
      data: "",
      json: { agentId: "main", status: "busy" },
    });

    expect(useAgentsStore.getState().agents[0]).toMatchObject({ id: "main", status: "busy" });
    expect(useAgentsStore.getState().selectedAgentId).toBeNull();
  });

  it("reduces declared status and activity events", () => {
    const agents = [{ id: "main", name: "Main", status: "idle" as const, isDefault: true }];
    const statusEvent: DeckGoServerEvent = {
      event: "agent.status.changed",
      data: "",
      json: { agentId: "main", status: "busy" },
    };
    const countEvent: DeckGoServerEvent = {
      event: "activity.event",
      data: "",
      json: { agentId: "main", type: "agent.session-count", sessionCount: 3, tsMs: 10 },
    };

    expect(readAgentMetricsAction(statusEvent)).toMatchObject({
      kind: "status",
      agentId: "main",
      status: "busy",
    });
    expect(reduceAgentMetricsEvent(agents, countEvent)[0]).toMatchObject({
      id: "main",
      sessionCount: 3,
      lastActiveAtMs: 10,
    });
  });
});

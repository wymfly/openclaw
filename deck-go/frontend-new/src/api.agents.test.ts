import { describe, expect, it } from "vitest";
import { normalizeAgentSubagentPermissionOptions } from "./api";

describe("agent API helpers", () => {
  it("represents wildcard subagent permissions as allow-any rows", () => {
    expect(
      normalizeAgentSubagentPermissionOptions({
        agentId: "main",
        allowAgents: ["*"],
        allowAny: true,
        allAgents: [
          { id: "main", name: "Main" },
          { id: "ops", name: "Ops" },
        ],
        configHash: "hash-1",
      }),
    ).toEqual([
      { id: "main", name: "Main", allowed: true },
      { id: "ops", name: "Ops", allowed: true },
    ]);
  });
});

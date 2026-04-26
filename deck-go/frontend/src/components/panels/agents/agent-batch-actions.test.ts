import { describe, expect, it } from "vitest";
import {
  buildAgentBatchExportText,
  summarizeAgents,
  type AgentBatchEntry,
} from "./agent-batch-actions";

const agents: AgentBatchEntry[] = [
  { id: "main", name: "Main", model: "gpt-5.4", status: "idle" },
  { id: "ops", name: "Ops", model: "gpt-5.4-mini", status: "busy" },
  { id: "audit", name: "Audit", model: "", status: "busy" },
];

describe("agent batch actions helpers", () => {
  it("builds a human-readable export table", () => {
    expect(buildAgentBatchExportText(agents)).toBe(
      [
        "name | id | model | status",
        "Main | main | gpt-5.4 | idle",
        "Ops | ops | gpt-5.4-mini | busy",
        "Audit | audit | - | busy",
      ].join("\n"),
    );
  });

  it("summarizes agents by status and model", () => {
    const summary = summarizeAgents(agents);
    expect(summary.total).toBe(3);
    expect(summary.byStatus.idle).toBe(1);
    expect(summary.byStatus.busy).toBe(2);
    expect(summary.byModel["gpt-5.4"]).toBe(1);
    expect(summary.byModel["gpt-5.4-mini"]).toBe(1);
    expect(summary.byModel.unassigned).toBe(1);
  });

  it("keeps Gateway-missing optional fields explicit instead of dropping rows", () => {
    const summary = summarizeAgents([{ id: "raw-agent" }]);
    expect(buildAgentBatchExportText([{ id: "raw-agent" }])).toBe(
      ["name | id | model | status", "raw-agent | raw-agent | - | unknown"].join("\n"),
    );
    expect(summary.byStatus.unknown).toBe(1);
    expect(summary.byModel.unassigned).toBe(1);
  });
});

import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { agentsKeys } from "./keys";
import { applyAgentStatusInvalidation, resolveAgentStatusInvalidation } from "./projections";

describe("Agents Data Fabric live projection policy", () => {
  it("maps status and activity events to Agents authoritative keys", () => {
    const statusResult = resolveAgentStatusInvalidation({
      event: "agent.status.changed",
      json: { agentId: "main", status: "busy" },
    });
    const activityResult = resolveAgentStatusInvalidation({
      event: "activity.event",
      json: { agentId: "ops", type: "agent.session-count", sessionCount: 3 },
    });

    expect(statusResult.invalidatedKeys).toContainEqual(agentsKeys.all());
    expect(statusResult.invalidatedKeys).toContainEqual(agentsKeys.detail("main"));
    expect(activityResult.invalidatedKeys).toContainEqual(agentsKeys.detail("ops"));
  });

  it("uses current projection gap metadata to refresh Agents read models", async () => {
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();

    const result = await applyAgentStatusInvalidation(queryClient, {
      event: "projection.gap",
      json: { reason: "cursor-missed" },
    });

    expect(result).toMatchObject({
      projectionId: "agent-status",
      stale: true,
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: agentsKeys.all() });
  });
});

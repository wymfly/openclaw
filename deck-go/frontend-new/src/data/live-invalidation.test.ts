import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { deckGoLiveProjectionContract } from "../../../contracts/generated/ts/deck-live-projections.generated";
import { deckKeys } from "./contracts/query-keys";
import {
  applyDataFabricLiveInvalidation,
  resolveDataFabricLiveInvalidation,
} from "./live-invalidation";

describe("Data Fabric live invalidation", () => {
  it("invalidates runtime-liveness keys for runtime gateway events", () => {
    const result = resolveDataFabricLiveInvalidation({ event: "runtime.gateway.status" });

    expect(result.invalidatedKeys).toEqual([deckKeys.runtime.all()]);
    expect(result.stale).toBe(false);
  });

  it("marks projection gaps stale and refreshes mapped authoritative keys", async () => {
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();
    const result = await applyDataFabricLiveInvalidation(
      queryClient,
      { event: "projection.gap", projectionId: "session-list" },
      {
        endpointKeys: {
          "GET /sessions": [deckKeys.sessions.list()],
        },
      },
    );

    expect(result).toMatchObject({
      projectionId: "session-list",
      refreshEndpoints: ["GET /sessions"],
      stale: true,
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: deckKeys.sessions.list() });
  });

  it("uses current generated projection fields without patch strategy metadata", () => {
    const projection = deckGoLiveProjectionContract.projections[0] as Record<string, unknown>;

    expect(projection).toHaveProperty("refreshEndpoints");
    expect(projection).toHaveProperty("gapPolicy");
    expect(projection).not.toHaveProperty("patchStrategy");
    expect(projection).not.toHaveProperty("patchKeys");
  });
});

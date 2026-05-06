import { describe, expect, it } from "vitest";
import { buildListQueryParams, withListQuery } from "./list-query-contract";

describe("list query contract helpers", () => {
  it("serializes known fields in contract order and ignores unknown fields", () => {
    expect(
      withListQuery("/monitor/runs", "monitor-runs", {
        unknown: "ignored",
        status: "running",
        cursor: "cursor-1",
        limit: 25,
        agentId: " main ",
      }),
    ).toBe("/monitor/runs?limit=25&agentId=main&cursor=cursor-1&status=running");
  });

  it("omits nullish, empty, and non-finite values", () => {
    expect(
      withListQuery("/sessions", "sessions-list", {
        agentId: " ",
        search: null,
        limit: Number.NaN,
        activeMinutes: undefined,
      }),
    ).toBe("/sessions");
  });

  it("honors boolean true-value semantics without emitting false", () => {
    expect(
      withListQuery("/usage/sessions", "usage-sessions", {
        includeContextWeight: true,
        limit: 20,
      }),
    ).toBe("/usage/sessions?includeContextWeight=true&limit=20");

    expect(
      withListQuery("/usage/sessions", "usage-sessions", {
        includeContextWeight: false,
        limit: 20,
      }),
    ).toBe("/usage/sessions?limit=20");
  });

  it("serializes array filters as csv values", () => {
    const params = buildListQueryParams("cron-runs", {
      sortDir: "desc",
      statuses: ["running", " failed ", ""],
    });

    expect(params.get("sortDir")).toBe("desc");
    expect(params.get("statuses")).toBe("running,failed");
  });
});

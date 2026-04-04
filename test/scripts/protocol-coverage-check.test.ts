import { describe, expect, it } from "vitest";
import {
  buildProtocolCoverageReport,
  collectProtocolMethodUsageFromSource,
} from "../../scripts/lib/protocol-coverage-report.ts";

describe("protocol coverage report", () => {
  it("counts typed coverage only for methods actually used through typed dashboard calls", () => {
    const report = buildProtocolCoverageReport({
      allMethodNames: ["chat.abort", "sessions.abort", "status"],
      typedSchemaMethods: new Set(["chat.abort", "sessions.abort"]),
      typedUsedMethods: new Set(["sessions.abort"]),
      untypedUsedMethods: new Set(["status"]),
      directUsedMethods: new Set(),
    });

    expect(report.summary).toEqual({
      total: 3,
      typed: 1,
      untyped: 1,
      direct: 0,
      notCovered: 1,
    });
    expect(report.notCoveredMethods).toEqual(["chat.abort"]);
  });

  it("tracks raw adapter requests separately from typed and gatewayRequest usage", () => {
    const report = buildProtocolCoverageReport({
      allMethodNames: ["chat.history", "sessions.list"],
      typedSchemaMethods: new Set(["chat.history", "sessions.list"]),
      typedUsedMethods: new Set(),
      untypedUsedMethods: new Set(),
      directUsedMethods: new Set(["chat.history"]),
    });

    expect(report.summary.direct).toBe(1);
    expect(report.directMethods).toEqual(["chat.history"]);
    expect(report.notCoveredMethods).toEqual(["sessions.list"]);
  });

  it("detects gwRequest, gatewayRequest, and direct adapter calls from dashboard source", () => {
    const usage = collectProtocolMethodUsageFromSource(`
      gwRequest(
        "sessions.abort",
        { key: "abc" },
      );
      gatewayRequest("status", {});
      await runtime.adapter.request("chat.history", { sessionKey: "abc" });
    `);

    expect([...usage.typedUsedMethods]).toEqual(["sessions.abort"]);
    expect([...usage.untypedUsedMethods]).toEqual(["status"]);
    expect([...usage.directUsedMethods]).toEqual(["chat.history"]);
  });
});

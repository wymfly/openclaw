import { describe, expect, it } from "vitest";
import { allMethodDefs, allMethodNames } from "./method-registry-data.js";

describe("gateway method registry data", () => {
  it("registers sessions.usage as a typed method with a result schema", () => {
    const def = allMethodDefs["sessions.usage"];
    expect(def).toBeDefined();
    expect(def?.params).toBeDefined();
    expect(def?.result).toBeDefined();
  });

  it("registers sessions.usage.logs and sessions.usage.timeseries as typed methods", () => {
    const logsDef = allMethodDefs["sessions.usage.logs"];
    const timeseriesDef = allMethodDefs["sessions.usage.timeseries"];

    expect(logsDef).toBeDefined();
    expect(logsDef?.params).toBeDefined();
    expect(logsDef?.result).toBeDefined();
    expect(timeseriesDef).toBeDefined();
    expect(timeseriesDef?.params).toBeDefined();
    expect(timeseriesDef?.result).toBeDefined();
  });

  it("includes sessions.usage in known method names for client generation", () => {
    expect(allMethodNames).toContain("sessions.usage");
  });

  it("includes sessions.usage.logs and sessions.usage.timeseries in known method names", () => {
    expect(allMethodNames).toContain("sessions.usage.logs");
    expect(allMethodNames).toContain("sessions.usage.timeseries");
  });
});

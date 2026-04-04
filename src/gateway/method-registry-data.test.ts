import { describe, expect, it } from "vitest";
import { allMethodDefs, allMethodNames } from "./method-registry-data.js";

describe("gateway method registry data", () => {
  it("registers sessions.usage as a typed method with a result schema", () => {
    const def = allMethodDefs["sessions.usage"];
    expect(def).toBeDefined();
    expect(def?.params).toBeDefined();
    expect(def?.result).toBeDefined();
  });

  it("includes sessions.usage in known method names for client generation", () => {
    expect(allMethodNames).toContain("sessions.usage");
  });
});

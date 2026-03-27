import { Type } from "@sinclair/typebox";
import { describe, expect, it } from "vitest";
import { buildMethodRegistry } from "./method-registry.js";
import type { GatewayRequestHandlers } from "./server-methods/types.js";

const TestParamsSchema = Type.Object({ id: Type.String() });
const TestResultSchema = Type.Object({ ok: Type.Boolean() });

const fakeHandlers: GatewayRequestHandlers = {
  "test.get": async ({ respond }) => respond(true, { ok: true }),
  "test.set": async ({ respond }) => respond(true, { ok: true }),
  "untyped.method": async ({ respond }) => respond(true, {}),
};

const testMethodDefs = {
  "test.get": {
    params: TestParamsSchema,
    result: TestResultSchema,
    scope: "operator.read" as const,
  },
  "test.set": {
    params: TestParamsSchema,
    result: TestResultSchema,
    scope: "operator.write" as const,
  },
};

describe("buildMethodRegistry", () => {
  it("registers typed methods from methodDefs", () => {
    const registry = buildMethodRegistry(fakeHandlers, [testMethodDefs]);
    expect(registry.getDefinition("test.get")).toBeDefined();
    expect(registry.getDefinition("test.get")?.params).toBe(TestParamsSchema);
    expect(registry.getDefinition("test.get")?.result).toBe(TestResultSchema);
    expect(registry.getDefinition("test.get")?.scope).toBe("operator.read");
  });

  it("registers untyped methods (handlers without methodDefs)", () => {
    const registry = buildMethodRegistry(fakeHandlers, [testMethodDefs]);
    expect(registry.getDefinition("untyped.method")).toBeDefined();
    expect(registry.getDefinition("untyped.method")?.params).toBeUndefined();
    expect(registry.getDefinition("untyped.method")?.result).toBeUndefined();
  });

  it("lists all methods", () => {
    const registry = buildMethodRegistry(fakeHandlers, [testMethodDefs]);
    const methods = registry.listMethods();
    expect(methods).toContain("test.get");
    expect(methods).toContain("test.set");
    expect(methods).toContain("untyped.method");
  });

  it("getScopeForMethod returns correct scope", () => {
    const registry = buildMethodRegistry(fakeHandlers, [testMethodDefs]);
    expect(registry.getScopeForMethod("test.get")).toBe("operator.read");
  });

  it("describe returns typed and untyped lists", () => {
    const registry = buildMethodRegistry(fakeHandlers, [testMethodDefs]);
    const desc = registry.describe({ filter: "all", includeSchemas: false });
    expect(desc.protocol).toBeGreaterThan(0);
    expect(desc.methods["test.get"]).toBeDefined();
    expect(desc.methods["test.get"].scope).toBe("operator.read");
    expect(desc.untyped).toContain("untyped.method");
  });

  it("describe with filter=typed excludes untyped", () => {
    const registry = buildMethodRegistry(fakeHandlers, [testMethodDefs]);
    const desc = registry.describe({ filter: "typed" });
    expect(desc.methods["test.get"]).toBeDefined();
    expect(desc.methods["untyped.method"]).toBeUndefined();
    expect(desc.untyped).toEqual([]);
  });

  it("throws if methodDef references nonexistent handler", () => {
    const badDefs = {
      "nonexistent.method": {
        params: TestParamsSchema,
        result: TestResultSchema,
        scope: "operator.read" as const,
      },
    };
    expect(() => buildMethodRegistry(fakeHandlers, [badDefs])).toThrow(/nonexistent\.method/);
  });
});

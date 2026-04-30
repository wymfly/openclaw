import { Type } from "@sinclair/typebox";
import { describe, expect, it } from "vitest";
import { buildMethodRegistry } from "./method-registry.js";
import type { GatewayRequestHandlers } from "./server-methods/types.js";

const TestParamsSchema = Type.Object({ id: Type.String() });
const TestResultSchema = Type.Object({ ok: Type.Boolean() });
const TestEventPayloadSchema = Type.Object({ runId: Type.String() });
const AlternateEventPayloadSchema = Type.Object({ sessionKey: Type.String() });

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

const testEventDefs = {
  "session.message": {
    payload: TestEventPayloadSchema,
    since: 3,
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

  it("registers typed events and exposes payload schemas in describe", () => {
    const registry = buildMethodRegistry(fakeHandlers, [testMethodDefs], testEventDefs);
    expect(registry.listEvents()).toContain("session.message");
    expect(registry.getEventDefinition("session.message")?.payload).toBe(TestEventPayloadSchema);

    const desc = registry.describe({ filter: "all", includeSchemas: true });
    expect(desc.events["session.message"]).toEqual({
      payload: TestEventPayloadSchema,
      since: 3,
    });
  });

  it("includes event schema changes in schemaVersion", () => {
    const first = buildMethodRegistry(fakeHandlers, [testMethodDefs], {
      "session.message": { payload: TestEventPayloadSchema },
    });
    const second = buildMethodRegistry(fakeHandlers, [testMethodDefs], {
      "session.message": { payload: AlternateEventPayloadSchema },
    });

    expect(first.describe().schemaVersion).not.toBe(second.describe().schemaVersion);
  });

  it("includes controlPlaneWrite metadata changes in schemaVersion", () => {
    const first = buildMethodRegistry(fakeHandlers, [testMethodDefs]);
    const second = buildMethodRegistry(fakeHandlers, [
      {
        ...testMethodDefs,
        "test.set": {
          ...testMethodDefs["test.set"],
          controlPlaneWrite: true,
        },
      },
    ]);

    expect(first.describe().schemaVersion).not.toBe(second.describe().schemaVersion);
    expect(second.describe().methods["test.set"].controlPlaneWrite).toBe(true);
  });

  it("includes fork metadata changes in schemaVersion", () => {
    const first = buildMethodRegistry(fakeHandlers, [testMethodDefs]);
    const second = buildMethodRegistry(fakeHandlers, [
      {
        ...testMethodDefs,
        "test.set": {
          ...testMethodDefs["test.set"],
          forkClass: "C3",
          bffEligible: true,
        },
      },
    ]);

    expect(first.describe().schemaVersion).not.toBe(second.describe().schemaVersion);
    expect(second.describe().methods["test.set"].forkClass).toBe("C3");
    expect(second.describe().methods["test.set"].bffEligible).toBe(true);
  });

  it("includes fork deprecation metadata changes in schemaVersion", () => {
    const first = buildMethodRegistry(fakeHandlers, [testMethodDefs]);
    const second = buildMethodRegistry(fakeHandlers, [
      {
        ...testMethodDefs,
        "test.set": {
          ...testMethodDefs["test.set"],
          forkDeprecated: true,
          forkDeprecationReplacement: "deck-go-bff/views.TestSet",
          forkDeprecationSince: "2026-05-01",
          forkDeprecationRemovalTarget: "2026-08-01",
        },
      },
    ]);

    expect(first.describe().schemaVersion).not.toBe(second.describe().schemaVersion);
    expect(second.describe().methods["test.set"]).toMatchObject({
      forkDeprecated: true,
      forkDeprecationReplacement: "deck-go-bff/views.TestSet",
      forkDeprecationSince: "2026-05-01",
      forkDeprecationRemovalTarget: "2026-08-01",
    });
  });

  it("keeps describe payload bytes stable when fork deprecation metadata is absent", () => {
    const first = buildMethodRegistry(fakeHandlers, [testMethodDefs]);
    const second = buildMethodRegistry(fakeHandlers, [testMethodDefs]);

    const firstBytes = JSON.stringify(first.describe({ filter: "all", includeSchemas: false }));
    const secondBytes = JSON.stringify(second.describe({ filter: "all", includeSchemas: false }));

    expect(firstBytes).toBe(secondBytes);
    expect(firstBytes).not.toContain("forkDeprecated");
    expect(firstBytes).not.toContain("forkDeprecationReplacement");
  });

  it("orders describe payload bytes deterministically when fork deprecation metadata is present", () => {
    const defs = {
      ...testMethodDefs,
      "test.set": {
        ...testMethodDefs["test.set"],
        forkDeprecated: true,
        forkDeprecationReplacement: "deck-go-bff/views.TestSet",
        forkDeprecationSince: "2026-05-01",
        forkDeprecationRemovalTarget: "2026-08-01",
      },
    };
    const first = buildMethodRegistry(fakeHandlers, [defs]);
    const second = buildMethodRegistry(fakeHandlers, [defs]);

    expect(JSON.stringify(first.describe({ filter: "all", includeSchemas: false }))).toBe(
      JSON.stringify(second.describe({ filter: "all", includeSchemas: false })),
    );
  });
});

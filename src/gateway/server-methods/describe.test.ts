import { describe, expect, it } from "vitest";
import { allEventNames, allMethodDefs, allMethodNames } from "../method-registry-data.js";

describe("gateway.describe handler", () => {
  it("registers the gateway.describe RPC handler", async () => {
    const { coreGatewayHandlers } = await import("../server-methods.js");
    expect(coreGatewayHandlers["gateway.describe"]).toBeTypeOf("function");
  });

  it("returns protocol version and method list", async () => {
    const { gatewayMethodRegistry } = await import("../server-methods.js");
    const desc = gatewayMethodRegistry.describe({ filter: "all" });
    expect(desc.protocol).toBe(3);
    expect(typeof desc.schemaVersion).toBe("string");
    expect(desc.methods).toBeDefined();
    // deck.agents.detail should be typed
    expect(desc.methods["deck.agents.detail"]).toBeDefined();
    expect(desc.methods["deck.agents.detail"].scope).toBe("operator.read");
    expect(desc.methods["gateway.describe"]).toBeDefined();
    expect(desc.methods["gateway.describe"].scope).toBe("operator.read");
  });

  it("lists untyped methods separately", async () => {
    const { gatewayMethodRegistry } = await import("../server-methods.js");
    const desc = gatewayMethodRegistry.describe({ filter: "all" });
    // P2 methods without result schemas show in untyped
    expect(desc.untyped.length).toBeGreaterThan(0);
  });

  it("includes schemas when requested", async () => {
    const { gatewayMethodRegistry } = await import("../server-methods.js");
    const desc = gatewayMethodRegistry.describe({ filter: "typed", includeSchemas: true });
    const detail = desc.methods["deck.agents.detail"];
    expect(detail).toBeDefined();
    expect(detail.params).toBeDefined();
    expect(detail.result).toBeDefined();
  });

  it("exposes chat.inject as a typed Gateway method", async () => {
    const { gatewayMethodRegistry } = await import("../server-methods.js");
    const desc = gatewayMethodRegistry.describe({ filter: "typed", includeSchemas: true });

    expect(desc.methods["chat.inject"]).toBeDefined();
    expect(desc.methods["chat.inject"]?.params).toBeDefined();
    expect(desc.methods["chat.inject"]?.result).toBeDefined();
    expect(desc.untyped).not.toContain("chat.inject");
  });

  it("exposes typed gateway event payload schemas for deck transcript consumers", async () => {
    const { gatewayMethodRegistry } = await import("../server-methods.js");
    const desc = gatewayMethodRegistry.describe({ filter: "all", includeSchemas: true });

    expect(desc.events.chat?.payload).toBeDefined();
    expect(desc.events["chat.side_result"]?.payload).toBeDefined();
    expect(desc.events.agent?.payload).toBeDefined();
    expect(desc.events["session.message"]?.payload).toBeDefined();
    expect(desc.events["session.tool"]?.payload).toBeDefined();
    expect(desc.events["sessions.changed"]?.payload).toBeDefined();
  });

  it("deck.auth methods are registered", async () => {
    const { gatewayMethodRegistry } = await import("../server-methods.js");
    const desc = gatewayMethodRegistry.describe({ filter: "all" });
    expect(desc.methods["deck.auth.overview"]).toBeDefined();
    expect(desc.methods["deck.auth.probe"]).toBeDefined();
  });

  it("exposes runtime auxiliary approval methods in gateway.describe", async () => {
    const { gatewayMethodRegistry } = await import("../server-methods.js");
    const desc = gatewayMethodRegistry.describe({ filter: "typed", includeSchemas: true });

    for (const method of [
      "exec.approval.list",
      "exec.approval.resolve",
      "plugin.approval.list",
      "plugin.approval.resolve",
    ]) {
      expect(desc.methods[method], method).toBeDefined();
      expect(desc.methods[method]?.params, `${method} params`).toBeDefined();
      expect(desc.methods[method]?.result, `${method} result`).toBeDefined();
    }
  });

  it("registers Skills methods from metadata-only control-plane definitions", async () => {
    const { gatewayMethodRegistry } = await import("../server-methods.js");
    const desc = gatewayMethodRegistry.describe({ filter: "typed", includeSchemas: true });

    for (const method of [
      "skills.status",
      "skills.bins",
      "skills.search",
      "skills.detail",
      "skills.install",
      "skills.update",
    ]) {
      expect(desc.methods[method], method).toBeDefined();
      expect(desc.methods[method]?.params, method).toBeDefined();
      expect(desc.methods[method]?.result, method).toBeDefined();
    }

    expect(desc.methods["skills.status"]?.scope).toBe("operator.read");
    expect(desc.methods["skills.bins"]?.scope).toBe("node");
  });

  it("keeps runtime describe method membership aligned with the runtime registry", async () => {
    const { gatewayMethodRegistry } = await import("../server-methods.js");
    const desc = gatewayMethodRegistry.describe({ filter: "all", includeSchemas: true });
    const describedMethods = [...Object.keys(desc.methods), ...desc.untyped].toSorted(
      (left, right) => left.localeCompare(right),
    );
    const runtimeMethods = gatewayMethodRegistry
      .listMethods()
      .toSorted((left, right) => left.localeCompare(right));
    const knownMethodSet = new Set(allMethodNames);

    expect(describedMethods).toEqual(runtimeMethods);
    expect(runtimeMethods.filter((method) => !knownMethodSet.has(method))).toEqual([]);
  });

  it("keeps runtime describe typed and untyped filters aligned with metadata", async () => {
    const { gatewayMethodRegistry } = await import("../server-methods.js");
    const typedDesc = gatewayMethodRegistry.describe({ filter: "typed", includeSchemas: true });
    const untypedDesc = gatewayMethodRegistry.describe({ filter: "untyped", includeSchemas: true });
    const typedMethods = gatewayMethodRegistry
      .listMethods()
      .filter((method) => {
        const def = gatewayMethodRegistry.getDefinition(method);
        return Boolean(def?.params || def?.result);
      })
      .toSorted((left, right) => left.localeCompare(right));
    const untypedMethods = gatewayMethodRegistry
      .listMethods()
      .filter((method) => {
        const def = gatewayMethodRegistry.getDefinition(method);
        return !def?.params && !def?.result;
      })
      .toSorted((left, right) => left.localeCompare(right));

    expect(
      Object.keys(typedDesc.methods).toSorted((left, right) => left.localeCompare(right)),
    ).toEqual(typedMethods);
    expect(untypedDesc.untyped.toSorted((left, right) => left.localeCompare(right))).toEqual(
      untypedMethods,
    );
    expect(Object.keys(untypedDesc.methods)).toEqual([]);
  });

  it("exposes runtime params and result schemas when static metadata exists", async () => {
    const { gatewayMethodRegistry } = await import("../server-methods.js");
    const desc = gatewayMethodRegistry.describe({ filter: "all", includeSchemas: true });

    for (const method of gatewayMethodRegistry.listMethods()) {
      const staticDef = allMethodDefs[method];
      const runtimeEntry = desc.methods[method];
      if (!staticDef || (!staticDef.params && !staticDef.result)) {
        continue;
      }
      expect(runtimeEntry, method).toBeDefined();
      if (staticDef.params) {
        expect(runtimeEntry.params, `${method} params`).toBeDefined();
      }
      if (staticDef.result) {
        expect(runtimeEntry.result, `${method} result`).toBeDefined();
      }
    }
  });

  it("keeps runtime describe event membership aligned with the static event list", async () => {
    const { gatewayMethodRegistry } = await import("../server-methods.js");
    const desc = gatewayMethodRegistry.describe({ filter: "all", includeSchemas: true });

    expect(Object.keys(desc.events).toSorted((left, right) => left.localeCompare(right))).toEqual(
      gatewayMethodRegistry.listEvents().toSorted((left, right) => left.localeCompare(right)),
    );
    expect(gatewayMethodRegistry.listEvents()).toEqual(allEventNames);
  });
});

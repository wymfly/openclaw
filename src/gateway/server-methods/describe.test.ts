import { describe, expect, it } from "vitest";

describe("gateway.describe handler", () => {
  it("returns protocol version and method list", async () => {
    const { gatewayMethodRegistry } = await import("../server-methods.js");
    const desc = gatewayMethodRegistry.describe({ filter: "all" });
    expect(desc.protocol).toBe(3);
    expect(typeof desc.schemaVersion).toBe("string");
    expect(desc.methods).toBeDefined();
    // deck.agents.detail should be typed
    expect(desc.methods["deck.agents.detail"]).toBeDefined();
    expect(desc.methods["deck.agents.detail"].scope).toBe("operator.read");
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

  it("deck.auth methods are registered", async () => {
    const { gatewayMethodRegistry } = await import("../server-methods.js");
    const desc = gatewayMethodRegistry.describe({ filter: "all" });
    expect(desc.methods["deck.auth.overview"]).toBeDefined();
    expect(desc.methods["deck.auth.probe"]).toBeDefined();
  });
});

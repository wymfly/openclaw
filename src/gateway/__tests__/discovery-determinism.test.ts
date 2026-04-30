import { describe, expect, it } from "vitest";
import { loadGatewayMethodModules } from "../method-registry.js";
import { gatewayMethodModules } from "../server-methods/_modules.generated.js";

function summarize(modules: typeof gatewayMethodModules): string {
  const loaded = loadGatewayMethodModules(modules);
  return JSON.stringify({
    modules: loaded.modules.map((module) => module.name),
    handlers: Object.keys(loaded.handlers),
    methodDefs: Object.keys(loaded.methodDefs),
    events: Object.keys(loaded.events),
  });
}

describe("gateway method discovery", () => {
  it("is deterministic across repeated loads and shuffled module order", () => {
    const first = summarize(gatewayMethodModules);
    const second = summarize(gatewayMethodModules);
    const shuffled = summarize(gatewayMethodModules.toReversed());

    expect(second).toBe(first);
    expect(shuffled).toBe(first);
  });
});

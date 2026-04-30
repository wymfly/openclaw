import { describe, expect, it } from "vitest";
import { loadGatewayMethodModules, type GatewayMethodModule } from "../method-registry.js";

const handler = ({ respond }: Parameters<GatewayMethodModule["handlers"][string]>[0]) => {
  respond(true);
};

describe("gateway method discovery duplicate detection", () => {
  it("fails fast when two modules register the same handler method", () => {
    const modules: GatewayMethodModule[] = [
      {
        name: "alpha",
        priority: 1,
        handlers: {
          "duplicate.method": handler,
        },
      },
      {
        name: "beta",
        priority: 2,
        handlers: {
          "duplicate.method": handler,
        },
      },
    ];

    expect(() => loadGatewayMethodModules(modules)).toThrow(
      'duplicate gateway method handler "duplicate.method" in alpha and beta',
    );
  });
});

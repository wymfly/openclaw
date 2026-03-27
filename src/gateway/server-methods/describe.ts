import type { GatewayRequestHandlers } from "./types.js";

// Registry is injected at assembly time to avoid circular imports
let registryRef: {
  describe: (opts?: { filter?: "all" | "typed" | "untyped"; includeSchemas?: boolean }) => unknown;
} | null = null;

export function setDescribeRegistry(registry: typeof registryRef) {
  registryRef = registry;
}

export const describeHandlers: GatewayRequestHandlers = {
  "gateway.describe": ({ params, respond }) => {
    if (!registryRef) {
      respond(false, undefined, { code: "UNAVAILABLE", message: "registry not initialized" });
      return;
    }
    const filter = (params?.filter as "all" | "typed" | "untyped") ?? "all";
    const includeSchemas = (params?.includeSchemas as boolean) ?? false;
    const result = registryRef.describe({ filter, includeSchemas });
    respond(true, result);
  },
};

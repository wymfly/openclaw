import { resolveAgentRoute } from "../../routing/resolve-route.js";
import type { RoutePeer } from "../../routing/resolve-route.js";
import {
  getSubagentDepth,
  normalizeAgentId,
  parseAgentSessionKey,
  resolveAgentIdFromSessionKey,
} from "../../routing/session-key.js";

export type { RoutePeer };

export interface RoutingService {
  readonly version: 1;
  readonly resolveAgentRoute: typeof resolveAgentRoute;
  readonly normalizeAgentId: typeof normalizeAgentId;
  readonly parseAgentSessionKey: typeof parseAgentSessionKey;
  readonly resolveAgentIdFromSessionKey: typeof resolveAgentIdFromSessionKey;
  readonly getSubagentDepth: typeof getSubagentDepth;
}

export function createRoutingService(): RoutingService {
  return {
    version: 1,
    resolveAgentRoute,
    normalizeAgentId,
    parseAgentSessionKey,
    resolveAgentIdFromSessionKey,
    getSubagentDepth,
  };
}

export const routingService = createRoutingService();

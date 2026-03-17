/**
 * Server module barrel export for openclaw-deck.
 * Usage: `import { getRuntime, getEventBus } from "@server"`
 */

// Runtime singleton
export { getRuntime, initRuntime, shutdownRuntime } from "./runtime";
export type { DeckRuntime, InitRuntimeSettings } from "./runtime";

// EventBus
export { EventBus, getEventBus } from "./event-bus";
export type { ServerEvent, ServerEventSubscriber, DeckEventType } from "./event-bus";

// Database
export { getDb, openDb } from "./db";

// Projection Store
export { ProjectionStore, getProjectionStore } from "./projection-store";

// Gateway Adapter
export { OpenClawGatewayAdapter } from "./gateway-adapter";

// Contracts
export type * from "./contracts";

// Access Gate
export { validateRequest, resolveToken, checkPublicBind } from "./access-gate";

// Rate Limiter
export { createRateLimiter } from "./rate-limit";

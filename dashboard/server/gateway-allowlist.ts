/**
 * Gateway method allowlist — derived from generated protocol registry.
 *
 * GENERATED_METHOD_ALLOWLIST covers all methods the registry knows about.
 * EXTRA_METHODS covers untyped methods the Deck still calls that don't have
 * methodDefs yet (e.g. upstream P2 methods). This set should shrink to zero
 * as P1 upstream result schemas are added.
 */
import { GENERATED_METHOD_ALLOWLIST } from "../src/types/gateway-client.generated";

const EXTRA_METHODS = new Set<string>([
  // Upstream methods the Deck uses but the registry doesn't know about yet
  "sessions.usage",
  "sessions.usage.timeseries",
  "sessions.usage.logs",
  "sessions.steer",
  "sessions.get",
  "tools.effective",
]);

export const DEFAULT_METHOD_ALLOWLIST = new Set<string>([
  ...GENERATED_METHOD_ALLOWLIST,
  ...EXTRA_METHODS,
]);

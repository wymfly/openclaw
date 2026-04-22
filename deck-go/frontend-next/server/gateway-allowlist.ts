/**
 * Gateway method allowlist — derived from generated protocol registry.
 *
 * GENERATED_METHOD_ALLOWLIST covers all Deck-consumed methods that have
 * registry/codegen ownership (i.e. methodDefs with typed params/result schemas).
 *
 * UNTYPED_METHOD_SUPPLEMENT lists methods the Dashboard consumes that do NOT
 * have methodDefs yet (so codegen cannot emit typed wrappers). These methods
 * exist and work in the Gateway; they just lack TypeBox schemas. Routes that
 * call these methods must use `gatewayRequest()` (untyped) rather than
 * `gwRequest()` (typed).
 */
import { GENERATED_METHOD_ALLOWLIST } from "../src/types/gateway-client.generated";

/** Methods consumed by Deck routes but not yet covered by methodDefs/codegen. */
const UNTYPED_METHOD_SUPPLEMENT: readonly string[] = [
  "commands.list",
  "logs.tail",
  "tools.catalog",
  "tools.effective",
];

export const DEFAULT_METHOD_ALLOWLIST = new Set<string>([
  ...GENERATED_METHOD_ALLOWLIST,
  ...UNTYPED_METHOD_SUPPLEMENT,
]);

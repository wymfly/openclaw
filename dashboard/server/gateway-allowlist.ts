/**
 * Gateway method allowlist — derived from generated protocol registry.
 *
 * GENERATED_METHOD_ALLOWLIST covers all Deck-consumed methods that have
 * registry/codegen ownership. Keep this file a pure generated passthrough;
 * do not reintroduce local allowlist seams unless a migration plan explicitly
 * calls for a temporary exception.
 */
import { GENERATED_METHOD_ALLOWLIST } from "../src/types/gateway-client.generated";

export const DEFAULT_METHOD_ALLOWLIST = new Set<string>(GENERATED_METHOD_ALLOWLIST);

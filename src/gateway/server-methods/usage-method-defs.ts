import type { MethodMetadata } from "../method-registry.js";
import { READ_SCOPE } from "../method-scopes.js";
import { SessionsUsageParamsSchema } from "../protocol/schema/sessions.js";
import { SessionsUsageResultSchema } from "../protocol/schema/usage-result-schemas.js";

export const usageMethodDefs: Record<string, MethodMetadata> = {
  "sessions.usage": {
    params: SessionsUsageParamsSchema,
    result: SessionsUsageResultSchema,
    scope: READ_SCOPE,
  },
};

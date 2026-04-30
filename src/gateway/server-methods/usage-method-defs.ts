import type { MethodMetadata } from "../method-registry.js";
import { READ_SCOPE } from "../method-scopes.js";
import { SessionsUsageParamsSchema } from "../protocol/schema/sessions.js";
import {
  SessionsUsageLogsParamsSchema,
  SessionsUsageLogsResultSchema,
  SessionsUsageResultSchema,
  SessionsUsageTimeseriesParamsSchema,
  SessionsUsageTimeseriesResultSchema,
} from "../protocol/schema/usage-result-schemas.js";

export const usageMethodDefs: Record<string, MethodMetadata> = {
  "sessions.usage": {
    params: SessionsUsageParamsSchema,
    result: SessionsUsageResultSchema,
    scope: READ_SCOPE,
    forkClass: "C1",
    bffEligible: false,
  },
  "sessions.usage.logs": {
    params: SessionsUsageLogsParamsSchema,
    result: SessionsUsageLogsResultSchema,
    scope: READ_SCOPE,
    forkClass: "C1",
    bffEligible: false,
  },
  "sessions.usage.timeseries": {
    params: SessionsUsageTimeseriesParamsSchema,
    result: SessionsUsageTimeseriesResultSchema,
    scope: READ_SCOPE,
    forkClass: "C1",
    bffEligible: false,
  },
};

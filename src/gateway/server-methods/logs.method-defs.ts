import type { GatewayMethodMetadataModule, MethodMetadata } from "../method-registry.js";
import { READ_SCOPE } from "../method-scopes.js";
import { LogsTailParamsSchema, LogsTailResultSchema } from "../protocol/schema/logs-chat.js";

export const logsMethodDefs: Record<string, MethodMetadata> = {
  "logs.tail": {
    params: LogsTailParamsSchema,
    result: LogsTailResultSchema,
    scope: READ_SCOPE,
  },
};

export const gatewayMethodMetadataModule: GatewayMethodMetadataModule = {
  name: "logs",
  priority: 20,
  methodDefs: logsMethodDefs,
};

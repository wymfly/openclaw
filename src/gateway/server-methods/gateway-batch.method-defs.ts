import type { GatewayMethodMetadataModule, MethodMetadata } from "../method-registry.js";
import { READ_SCOPE } from "../method-scopes.js";
import {
  GatewayBatchParamsSchema,
  GatewayBatchResultSchema,
} from "../protocol/schema/gateway-batch.js";

export const gatewayBatchMethodDefs: Record<string, MethodMetadata> = {
  "gateway.batch": {
    params: GatewayBatchParamsSchema,
    result: GatewayBatchResultSchema,
    scope: READ_SCOPE,
    forkClass: "C5",
  },
};

export const gatewayMethodMetadataModule: GatewayMethodMetadataModule = {
  name: "gateway-batch",
  priority: 340,
  methodDefs: gatewayBatchMethodDefs,
};

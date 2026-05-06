import type { GatewayMethodMetadataModule, MethodMetadata } from "../method-registry.js";
import { WRITE_SCOPE } from "../method-scopes.js";
import {
  NodePendingEnqueueParamsSchema,
  NodePendingEnqueueResultSchema,
} from "../protocol/schema/nodes.js";

export const nodePendingMethodDefs: Record<string, MethodMetadata> = {
  "node.pending.enqueue": {
    params: NodePendingEnqueueParamsSchema,
    result: NodePendingEnqueueResultSchema,
    scope: WRITE_SCOPE,
  },
};

export const gatewayMethodMetadataModule: GatewayMethodMetadataModule = {
  name: "nodes-pending",
  priority: 260,
  methodDefs: nodePendingMethodDefs,
};

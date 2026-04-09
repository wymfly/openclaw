import type { MethodMetadata } from "../method-registry.js";
import { PAIRING_SCOPE, READ_SCOPE } from "../method-scopes.js";
import {
  NodeDescribeParamsSchema,
  NodeDescribeResultSchema,
  NodeListParamsSchema,
  NodeListResultSchema,
  NodePairApproveParamsSchema,
  NodePairApproveResultSchema,
  NodePairListParamsSchema,
  NodePairListResultSchema,
  NodePairRejectParamsSchema,
  NodePairRejectResultSchema,
  NodePairRequestParamsSchema,
  NodePairRequestResultSchema,
  NodePairVerifyParamsSchema,
  NodePairVerifyResultSchema,
  NodeRenameParamsSchema,
  NodeRenameResultSchema,
} from "../protocol/schema/nodes.js";

export const nodeMethodDefs: Record<string, MethodMetadata> = {
  "node.list": {
    params: NodeListParamsSchema,
    result: NodeListResultSchema,
    scope: READ_SCOPE,
  },
  "node.describe": {
    params: NodeDescribeParamsSchema,
    result: NodeDescribeResultSchema,
    scope: READ_SCOPE,
  },
  "node.pair.list": {
    params: NodePairListParamsSchema,
    result: NodePairListResultSchema,
    scope: PAIRING_SCOPE,
  },
  "node.pair.request": {
    params: NodePairRequestParamsSchema,
    result: NodePairRequestResultSchema,
    scope: PAIRING_SCOPE,
  },
  "node.pair.approve": {
    params: NodePairApproveParamsSchema,
    result: NodePairApproveResultSchema,
    scope: PAIRING_SCOPE,
  },
  "node.pair.reject": {
    params: NodePairRejectParamsSchema,
    result: NodePairRejectResultSchema,
    scope: PAIRING_SCOPE,
  },
  "node.pair.verify": {
    params: NodePairVerifyParamsSchema,
    result: NodePairVerifyResultSchema,
    scope: PAIRING_SCOPE,
  },
  "node.rename": {
    params: NodeRenameParamsSchema,
    result: NodeRenameResultSchema,
    scope: PAIRING_SCOPE,
  },
};

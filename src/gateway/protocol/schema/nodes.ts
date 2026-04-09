import { Type } from "@sinclair/typebox";
import { NonEmptyString } from "./primitives.js";

const NodePendingWorkTypeSchema = Type.String({
  enum: ["status.request", "location.request"],
});

const NodePendingWorkPrioritySchema = Type.String({
  enum: ["normal", "high"],
});

export const NodePairRequestParamsSchema = Type.Object(
  {
    nodeId: NonEmptyString,
    displayName: Type.Optional(NonEmptyString),
    platform: Type.Optional(NonEmptyString),
    version: Type.Optional(NonEmptyString),
    coreVersion: Type.Optional(NonEmptyString),
    uiVersion: Type.Optional(NonEmptyString),
    deviceFamily: Type.Optional(NonEmptyString),
    modelIdentifier: Type.Optional(NonEmptyString),
    caps: Type.Optional(Type.Array(NonEmptyString)),
    commands: Type.Optional(Type.Array(NonEmptyString)),
    remoteIp: Type.Optional(NonEmptyString),
    silent: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);

export const NodePairListParamsSchema = Type.Object({}, { additionalProperties: false });

export const NodePairApproveParamsSchema = Type.Object(
  { requestId: NonEmptyString },
  { additionalProperties: false },
);

export const NodePairRejectParamsSchema = Type.Object(
  { requestId: NonEmptyString },
  { additionalProperties: false },
);

export const NodePairVerifyParamsSchema = Type.Object(
  { nodeId: NonEmptyString, token: NonEmptyString },
  { additionalProperties: false },
);

export const NodeRenameParamsSchema = Type.Object(
  { nodeId: NonEmptyString, displayName: NonEmptyString },
  { additionalProperties: false },
);

export const NodeListParamsSchema = Type.Object({}, { additionalProperties: false });

export const NodePendingAckParamsSchema = Type.Object(
  {
    ids: Type.Array(NonEmptyString, { minItems: 1 }),
  },
  { additionalProperties: false },
);

export const NodeDescribeParamsSchema = Type.Object(
  { nodeId: NonEmptyString },
  { additionalProperties: false },
);

export const NodeInvokeParamsSchema = Type.Object(
  {
    nodeId: NonEmptyString,
    command: NonEmptyString,
    params: Type.Optional(Type.Unknown()),
    timeoutMs: Type.Optional(Type.Integer({ minimum: 0 })),
    idempotencyKey: NonEmptyString,
  },
  { additionalProperties: false },
);

export const NodeInvokeResultParamsSchema = Type.Object(
  {
    id: NonEmptyString,
    nodeId: NonEmptyString,
    ok: Type.Boolean(),
    payload: Type.Optional(Type.Unknown()),
    payloadJSON: Type.Optional(Type.String()),
    error: Type.Optional(
      Type.Object(
        {
          code: Type.Optional(NonEmptyString),
          message: Type.Optional(NonEmptyString),
        },
        { additionalProperties: false },
      ),
    ),
  },
  { additionalProperties: false },
);

export const NodeEventParamsSchema = Type.Object(
  {
    event: NonEmptyString,
    payload: Type.Optional(Type.Unknown()),
    payloadJSON: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export const NodePendingDrainParamsSchema = Type.Object(
  {
    maxItems: Type.Optional(Type.Integer({ minimum: 1, maximum: 10 })),
  },
  { additionalProperties: false },
);

export const NodePendingDrainItemSchema = Type.Object(
  {
    id: NonEmptyString,
    type: NodePendingWorkTypeSchema,
    priority: Type.String({ enum: ["default", "normal", "high"] }),
    createdAtMs: Type.Integer({ minimum: 0 }),
    expiresAtMs: Type.Optional(Type.Union([Type.Integer({ minimum: 0 }), Type.Null()])),
    payload: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  },
  { additionalProperties: false },
);

export const NodePendingDrainResultSchema = Type.Object(
  {
    nodeId: NonEmptyString,
    revision: Type.Integer({ minimum: 0 }),
    items: Type.Array(NodePendingDrainItemSchema),
    hasMore: Type.Boolean(),
  },
  { additionalProperties: false },
);

export const NodePendingEnqueueParamsSchema = Type.Object(
  {
    nodeId: NonEmptyString,
    type: NodePendingWorkTypeSchema,
    priority: Type.Optional(NodePendingWorkPrioritySchema),
    expiresInMs: Type.Optional(Type.Integer({ minimum: 1_000, maximum: 86_400_000 })),
    wake: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);

export const NodePendingEnqueueResultSchema = Type.Object(
  {
    nodeId: NonEmptyString,
    revision: Type.Integer({ minimum: 0 }),
    queued: NodePendingDrainItemSchema,
    wakeTriggered: Type.Boolean(),
  },
  { additionalProperties: false },
);

// ---------------------------------------------------------------------------
// Result schemas for node.* P0 methods (Deck Phase 4)
// ---------------------------------------------------------------------------

const NodeMetadataFields = {
  nodeId: NonEmptyString,
  displayName: Type.Optional(NonEmptyString),
  platform: Type.Optional(NonEmptyString),
  version: Type.Optional(NonEmptyString),
  coreVersion: Type.Optional(NonEmptyString),
  uiVersion: Type.Optional(NonEmptyString),
  deviceFamily: Type.Optional(NonEmptyString),
  modelIdentifier: Type.Optional(NonEmptyString),
  remoteIp: Type.Optional(NonEmptyString),
  caps: Type.Array(Type.String()),
  commands: Type.Array(Type.String()),
  pathEnv: Type.Optional(Type.String()),
  permissions: Type.Optional(Type.Record(Type.String(), Type.Boolean())),
  connectedAtMs: Type.Optional(Type.Integer({ minimum: 0 })),
  paired: Type.Boolean(),
  connected: Type.Boolean(),
};

const NodeSummarySchema = Type.Object(NodeMetadataFields, { additionalProperties: false });

/** node.list → { ts, nodes } */
export const NodeListResultSchema = Type.Object(
  {
    ts: Type.Integer({ minimum: 0 }),
    nodes: Type.Array(NodeSummarySchema),
  },
  { additionalProperties: false },
);

/** node.describe → single node detail */
export const NodeDescribeResultSchema = Type.Object(
  {
    ts: Type.Integer({ minimum: 0 }),
    ...NodeMetadataFields,
  },
  { additionalProperties: false },
);

const NodePairingPendingRequestSchema = Type.Object(
  {
    requestId: NonEmptyString,
    nodeId: NonEmptyString,
    displayName: Type.Optional(NonEmptyString),
    platform: Type.Optional(NonEmptyString),
    version: Type.Optional(NonEmptyString),
    coreVersion: Type.Optional(NonEmptyString),
    uiVersion: Type.Optional(NonEmptyString),
    deviceFamily: Type.Optional(NonEmptyString),
    modelIdentifier: Type.Optional(NonEmptyString),
    caps: Type.Optional(Type.Array(NonEmptyString)),
    commands: Type.Optional(Type.Array(NonEmptyString)),
    remoteIp: Type.Optional(NonEmptyString),
    silent: Type.Optional(Type.Boolean()),
    isRepair: Type.Optional(Type.Boolean()),
    ts: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
);

const NodePairingPairedNodeSchema = Type.Object(
  {
    nodeId: NonEmptyString,
    displayName: Type.Optional(NonEmptyString),
    platform: Type.Optional(NonEmptyString),
    version: Type.Optional(NonEmptyString),
    coreVersion: Type.Optional(NonEmptyString),
    uiVersion: Type.Optional(NonEmptyString),
    deviceFamily: Type.Optional(NonEmptyString),
    modelIdentifier: Type.Optional(NonEmptyString),
    caps: Type.Optional(Type.Array(NonEmptyString)),
    commands: Type.Optional(Type.Array(NonEmptyString)),
    remoteIp: Type.Optional(NonEmptyString),
    token: NonEmptyString,
    bins: Type.Optional(Type.Array(NonEmptyString)),
    createdAtMs: Type.Integer({ minimum: 0 }),
    approvedAtMs: Type.Integer({ minimum: 0 }),
    lastConnectedAtMs: Type.Optional(Type.Integer({ minimum: 0 })),
  },
  { additionalProperties: false },
);

/** node.pair.list → { pending, paired } */
export const NodePairListResultSchema = Type.Object(
  {
    pending: Type.Array(NodePairingPendingRequestSchema),
    paired: Type.Array(NodePairingPairedNodeSchema),
  },
  { additionalProperties: false },
);

/** node.pair.request → { status, request, created } */
export const NodePairRequestResultSchema = Type.Object(
  {
    status: Type.String({ enum: ["pending"] }),
    request: NodePairingPendingRequestSchema,
    created: Type.Boolean(),
  },
  { additionalProperties: false },
);

/** node.pair.approve → { requestId, node } */
export const NodePairApproveResultSchema = Type.Object(
  {
    requestId: NonEmptyString,
    node: NodePairingPairedNodeSchema,
  },
  { additionalProperties: false },
);

/** node.pair.reject → { requestId, nodeId } */
export const NodePairRejectResultSchema = Type.Object(
  {
    requestId: NonEmptyString,
    nodeId: NonEmptyString,
  },
  { additionalProperties: false },
);

/** node.pair.verify → { ok, node? } */
export const NodePairVerifyResultSchema = Type.Object(
  {
    ok: Type.Boolean(),
    node: Type.Optional(NodePairingPairedNodeSchema),
  },
  { additionalProperties: false },
);

/** node.rename → { nodeId, displayName } */
export const NodeRenameResultSchema = Type.Object(
  {
    nodeId: NonEmptyString,
    displayName: NonEmptyString,
  },
  { additionalProperties: false },
);

export const NodeInvokeRequestEventSchema = Type.Object(
  {
    id: NonEmptyString,
    nodeId: NonEmptyString,
    command: NonEmptyString,
    paramsJSON: Type.Optional(Type.String()),
    timeoutMs: Type.Optional(Type.Integer({ minimum: 0 })),
    idempotencyKey: Type.Optional(NonEmptyString),
  },
  { additionalProperties: false },
);

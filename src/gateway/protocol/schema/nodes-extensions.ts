import { Type } from "@sinclair/typebox";
import { NonEmptyString } from "./primitives.js";

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

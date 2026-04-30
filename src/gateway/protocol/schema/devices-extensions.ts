import { Type } from "@sinclair/typebox";
import { NonEmptyString } from "./primitives.js";

// ---------------------------------------------------------------------------
// Result schemas for device.* methods
// ---------------------------------------------------------------------------

const DeviceAuthTokenSummarySchema = Type.Object(
  {
    role: NonEmptyString,
    scopes: Type.Array(NonEmptyString),
    createdAtMs: Type.Integer({ minimum: 0 }),
    rotatedAtMs: Type.Optional(Type.Integer({ minimum: 0 })),
    revokedAtMs: Type.Optional(Type.Integer({ minimum: 0 })),
    lastUsedAtMs: Type.Optional(Type.Integer({ minimum: 0 })),
  },
  { additionalProperties: false },
);

const RedactedPairedDeviceSchema = Type.Object(
  {
    deviceId: NonEmptyString,
    publicKey: NonEmptyString,
    displayName: Type.Optional(NonEmptyString),
    platform: Type.Optional(NonEmptyString),
    deviceFamily: Type.Optional(NonEmptyString),
    clientId: Type.Optional(NonEmptyString),
    clientMode: Type.Optional(NonEmptyString),
    role: Type.Optional(NonEmptyString),
    roles: Type.Optional(Type.Array(NonEmptyString)),
    scopes: Type.Optional(Type.Array(NonEmptyString)),
    remoteIp: Type.Optional(NonEmptyString),
    createdAtMs: Type.Integer({ minimum: 0 }),
    approvedAtMs: Type.Integer({ minimum: 0 }),
    tokens: Type.Optional(Type.Array(DeviceAuthTokenSummarySchema)),
  },
  { additionalProperties: false },
);

const DevicePendingRequestSchema = Type.Object(
  {
    requestId: NonEmptyString,
    deviceId: NonEmptyString,
    publicKey: NonEmptyString,
    displayName: Type.Optional(NonEmptyString),
    platform: Type.Optional(NonEmptyString),
    deviceFamily: Type.Optional(NonEmptyString),
    clientId: Type.Optional(NonEmptyString),
    clientMode: Type.Optional(NonEmptyString),
    role: Type.Optional(NonEmptyString),
    roles: Type.Optional(Type.Array(NonEmptyString)),
    scopes: Type.Optional(Type.Array(NonEmptyString)),
    remoteIp: Type.Optional(NonEmptyString),
    silent: Type.Optional(Type.Boolean()),
    isRepair: Type.Optional(Type.Boolean()),
    ts: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
);

/** device.pair.list → { pending, paired } */
export const DevicePairListResultSchema = Type.Object(
  {
    pending: Type.Array(DevicePendingRequestSchema),
    paired: Type.Array(RedactedPairedDeviceSchema),
  },
  { additionalProperties: false },
);

/** device.pair.approve → { requestId, device } */
export const DevicePairApproveResultSchema = Type.Object(
  {
    requestId: NonEmptyString,
    device: RedactedPairedDeviceSchema,
  },
  { additionalProperties: false },
);

/** device.pair.reject → { requestId, deviceId } */
export const DevicePairRejectResultSchema = Type.Object(
  {
    requestId: NonEmptyString,
    deviceId: NonEmptyString,
  },
  { additionalProperties: false },
);

/** device.pair.remove → { deviceId } */
export const DevicePairRemoveResultSchema = Type.Object(
  {
    deviceId: NonEmptyString,
  },
  { additionalProperties: false },
);

/** device.token.rotate → { deviceId, role, token, scopes, rotatedAtMs } */
export const DeviceTokenRotateResultSchema = Type.Object(
  {
    deviceId: NonEmptyString,
    role: NonEmptyString,
    token: NonEmptyString,
    scopes: Type.Array(NonEmptyString),
    rotatedAtMs: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
);

/** device.token.revoke → { deviceId, role, revokedAtMs } */
export const DeviceTokenRevokeResultSchema = Type.Object(
  {
    deviceId: NonEmptyString,
    role: NonEmptyString,
    revokedAtMs: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
);

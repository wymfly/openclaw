import { Type } from "@sinclair/typebox";
import { NonEmptyString } from "./primitives.js";

export const ExecApprovalListParamsSchema = Type.Object({}, { additionalProperties: false });

export const ExecApprovalListRecordSchema = Type.Object(
  {
    id: NonEmptyString,
    request: Type.Unknown(),
    createdAtMs: Type.Integer({ minimum: 0 }),
    expiresAtMs: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
);

export const ExecApprovalListResultSchema = Type.Array(ExecApprovalListRecordSchema);

export const ExecApprovalRequestResultSchema = Type.Object(
  {
    id: NonEmptyString,
    status: Type.Optional(Type.String()),
    decision: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    createdAtMs: Type.Optional(Type.Integer({ minimum: 0 })),
    expiresAtMs: Type.Optional(Type.Integer({ minimum: 0 })),
  },
  { additionalProperties: false },
);

export const ExecApprovalResolveResultSchema = Type.Object(
  {
    ok: Type.Literal(true),
  },
  { additionalProperties: false },
);

export const ExecApprovalWaitDecisionResultSchema = Type.Object(
  {
    id: NonEmptyString,
    decision: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    createdAtMs: Type.Optional(Type.Integer({ minimum: 0 })),
    expiresAtMs: Type.Optional(Type.Integer({ minimum: 0 })),
  },
  { additionalProperties: false },
);

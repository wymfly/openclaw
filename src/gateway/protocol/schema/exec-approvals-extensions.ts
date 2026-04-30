import { Type } from "@sinclair/typebox";
import { NonEmptyString } from "./primitives.js";

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

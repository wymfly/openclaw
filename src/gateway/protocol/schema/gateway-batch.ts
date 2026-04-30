import { Type } from "@sinclair/typebox";
import { ErrorShapeSchema } from "./frames.js";

export const GatewayBatchCallSchema = Type.Object(
  {
    id: Type.String({ minLength: 1, maxLength: 64 }),
    method: Type.String({ minLength: 1 }),
    params: Type.Optional(Type.Unknown()),
  },
  { additionalProperties: false },
);

export const GatewayBatchParamsSchema = Type.Object(
  {
    calls: Type.Array(GatewayBatchCallSchema, { minItems: 1, maxItems: 32 }),
    options: Type.Optional(
      Type.Object(
        {
          failFast: Type.Optional(Type.Boolean()),
          timeoutMs: Type.Optional(
            Type.Integer({
              minimum: 1,
              maximum: 30_000,
              description: "Reserved in v1. Accepted on the wire but not enforced by Gateway.",
            }),
          ),
        },
        { additionalProperties: false },
      ),
    ),
  },
  { additionalProperties: false },
);

export const GatewayBatchResultEntrySchema = Type.Object(
  {
    id: Type.String({ minLength: 1, maxLength: 64 }),
    ok: Type.Boolean(),
    result: Type.Optional(Type.Unknown()),
    error: Type.Optional(ErrorShapeSchema),
  },
  { additionalProperties: false },
);

export const GatewayBatchResultSchema = Type.Object(
  {
    results: Type.Array(GatewayBatchResultEntrySchema),
  },
  { additionalProperties: false },
);

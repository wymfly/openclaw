import { Type } from "@sinclair/typebox";
import { NonEmptyString } from "./primitives.js";

const ConfigSchemaLookupPathString = Type.String({
  minLength: 0,
  maxLength: 1024,
  pattern: "^$|^[A-Za-z0-9_./\\[\\]\\-*]+$",
});

export const ConfigGetParamsSchema = Type.Object({}, { additionalProperties: false });

export const ConfigGetResultSchema = Type.Object(
  {
    path: Type.String(),
    exists: Type.Boolean(),
    raw: Type.Union([Type.String(), Type.Null()]),
    parsed: Type.Unsafe<unknown>({}),
    sourceConfig: Type.Unsafe<unknown>({}),
    resolved: Type.Unsafe<unknown>({}),
    valid: Type.Boolean(),
    runtimeConfig: Type.Unsafe<unknown>({}),
    config: Type.Unsafe<unknown>({}),
    hash: Type.Optional(Type.String()),
    issues: Type.Array(Type.Unsafe<unknown>({})),
    warnings: Type.Array(Type.Unsafe<unknown>({})),
    legacyIssues: Type.Array(Type.Unsafe<unknown>({})),
  },
  { additionalProperties: false },
);

export const ConfigSetParamsSchema = Type.Object(
  {
    raw: NonEmptyString,
    baseHash: Type.Optional(NonEmptyString),
  },
  { additionalProperties: false },
);

export const ConfigWriteResultSchema = Type.Object(
  {
    ok: Type.Boolean(),
    noop: Type.Optional(Type.Boolean()),
    path: Type.String(),
    config: Type.Unsafe<unknown>({}),
    restart: Type.Optional(Type.Unsafe<unknown>({})),
    sentinel: Type.Optional(Type.Unsafe<unknown>({})),
  },
  { additionalProperties: false },
);

const ConfigApplyLikeParamsSchema = Type.Object(
  {
    raw: NonEmptyString,
    baseHash: Type.Optional(NonEmptyString),
    sessionKey: Type.Optional(Type.String()),
    deliveryContext: Type.Optional(
      Type.Object(
        {
          channel: Type.Optional(Type.String()),
          to: Type.Optional(Type.String()),
          accountId: Type.Optional(Type.String()),
          threadId: Type.Optional(Type.Union([Type.String(), Type.Number()])),
        },
        { additionalProperties: false },
      ),
    ),
    note: Type.Optional(Type.String()),
    restartDelayMs: Type.Optional(Type.Integer({ minimum: 0 })),
  },
  { additionalProperties: false },
);

export const ConfigApplyParamsSchema = ConfigApplyLikeParamsSchema;
export const ConfigPatchParamsSchema = ConfigApplyLikeParamsSchema;

export const ConfigSchemaParamsSchema = Type.Object({}, { additionalProperties: false });

export const ConfigSchemaLookupParamsSchema = Type.Object(
  {
    path: ConfigSchemaLookupPathString,
  },
  { additionalProperties: false },
);

export const UpdateRunParamsSchema = Type.Object(
  {
    sessionKey: Type.Optional(Type.String()),
    deliveryContext: Type.Optional(
      Type.Object(
        {
          channel: Type.Optional(Type.String()),
          to: Type.Optional(Type.String()),
          accountId: Type.Optional(Type.String()),
          threadId: Type.Optional(Type.Union([Type.String(), Type.Number()])),
        },
        { additionalProperties: false },
      ),
    ),
    note: Type.Optional(Type.String()),
    restartDelayMs: Type.Optional(Type.Integer({ minimum: 0 })),
    timeoutMs: Type.Optional(Type.Integer({ minimum: 1 })),
  },
  { additionalProperties: false },
);

export const ConfigUiHintSchema = Type.Object(
  {
    label: Type.Optional(Type.String()),
    help: Type.Optional(Type.String()),
    tags: Type.Optional(Type.Array(Type.String())),
    group: Type.Optional(Type.String()),
    order: Type.Optional(Type.Integer()),
    advanced: Type.Optional(Type.Boolean()),
    sensitive: Type.Optional(Type.Boolean()),
    placeholder: Type.Optional(Type.String()),
    itemTemplate: Type.Optional(Type.Unknown()),
  },
  { additionalProperties: false },
);

export const ConfigSchemaResponseSchema = Type.Object(
  {
    schema: Type.Unknown(),
    uiHints: Type.Record(Type.String(), ConfigUiHintSchema),
    version: NonEmptyString,
    generatedAt: NonEmptyString,
  },
  { additionalProperties: false },
);

export const ConfigSchemaLookupChildSchema = Type.Object(
  {
    key: NonEmptyString,
    path: NonEmptyString,
    type: Type.Optional(Type.Union([Type.String(), Type.Array(Type.String())])),
    required: Type.Boolean(),
    hasChildren: Type.Boolean(),
    hint: Type.Optional(ConfigUiHintSchema),
    hintPath: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export const ConfigSchemaLookupResultSchema = Type.Object(
  {
    path: ConfigSchemaLookupPathString,
    schema: Type.Unknown(),
    hint: Type.Optional(ConfigUiHintSchema),
    hintPath: Type.Optional(Type.String()),
    children: Type.Array(ConfigSchemaLookupChildSchema),
  },
  { additionalProperties: false },
);

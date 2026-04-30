import { Type } from "@sinclair/typebox";

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

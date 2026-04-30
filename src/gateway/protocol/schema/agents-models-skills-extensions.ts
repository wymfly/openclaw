import { Type } from "@sinclair/typebox";
import { NonEmptyString } from "./primitives.js";

export const ModelsConfiguredParamsSchema = Type.Object({}, { additionalProperties: false });

export const ModelsConfiguredResultSchema = Type.Object(
  {
    models: Type.Array(
      Type.Object({
        id: Type.String(),
        name: Type.String(),
        provider: Type.String(),
        contextWindow: Type.Optional(Type.Number()),
        reasoning: Type.Optional(Type.Boolean()),
        input: Type.Optional(Type.Array(Type.String())),
        cost: Type.Optional(
          Type.Object({
            input: Type.Number(),
            output: Type.Number(),
            cacheRead: Type.Number(),
            cacheWrite: Type.Number(),
          }),
        ),
        maxTokens: Type.Optional(Type.Number()),
        authStatus: Type.String(),
      }),
    ),
  },
  { additionalProperties: false },
);

export const SkillsInstallResultSchema = Type.Object(
  {
    ok: Type.Boolean(),
    message: Type.String(),
    stdout: Type.String(),
    stderr: Type.String(),
    code: Type.Union([Type.Integer(), Type.Null()]),
    slug: Type.Optional(Type.String()),
    version: Type.Optional(Type.String()),
    targetDir: Type.Optional(Type.String()),
    warnings: Type.Optional(Type.Array(Type.String())),
  },
  { additionalProperties: false },
);

// ---------------------------------------------------------------------------
// Skills status/update result schemas (fork-only: Deck SDK)
// ---------------------------------------------------------------------------

const SkillInstallOptionSchema = Type.Object(
  {
    id: NonEmptyString,
    kind: Type.String(),
    label: NonEmptyString,
    bins: Type.Array(Type.String()),
  },
  { additionalProperties: false },
);

const RequirementsSchema = Type.Object(
  {
    bins: Type.Array(Type.String()),
    anyBins: Type.Array(Type.String()),
    env: Type.Array(Type.String()),
    config: Type.Array(Type.String()),
    os: Type.Array(Type.String()),
  },
  { additionalProperties: false },
);

const SkillStatusConfigCheckSchema = Type.Object(
  {
    path: Type.String(),
    satisfied: Type.Boolean(),
  },
  { additionalProperties: false },
);

const SkillStatusEntrySchema = Type.Object(
  {
    name: NonEmptyString,
    description: Type.String(),
    source: Type.String(),
    bundled: Type.Boolean(),
    filePath: Type.String(),
    baseDir: Type.String(),
    skillKey: Type.String(),
    primaryEnv: Type.Optional(Type.String()),
    emoji: Type.Optional(Type.String()),
    homepage: Type.Optional(Type.String()),
    always: Type.Boolean(),
    disabled: Type.Boolean(),
    blockedByAllowlist: Type.Boolean(),
    eligible: Type.Boolean(),
    requirements: RequirementsSchema,
    missing: RequirementsSchema,
    configChecks: Type.Array(SkillStatusConfigCheckSchema),
    install: Type.Array(SkillInstallOptionSchema),
  },
  { additionalProperties: false },
);

export const SkillsStatusResultSchema = Type.Object(
  {
    workspaceDir: Type.String(),
    managedSkillsDir: Type.String(),
    skills: Type.Array(SkillStatusEntrySchema),
  },
  { additionalProperties: false },
);

export const SkillsUpdateResultSchema = Type.Object(
  {
    ok: Type.Boolean(),
    skillKey: Type.String(),
    config: Type.Unknown(),
  },
  { additionalProperties: false },
);

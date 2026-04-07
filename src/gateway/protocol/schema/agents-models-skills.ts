import { Type } from "@sinclair/typebox";
import { NonEmptyString } from "./primitives.js";

export const ModelChoiceSchema = Type.Object(
  {
    id: NonEmptyString,
    name: NonEmptyString,
    provider: NonEmptyString,
    contextWindow: Type.Optional(Type.Integer({ minimum: 1 })),
    reasoning: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);

export const AgentSummarySchema = Type.Object(
  {
    id: NonEmptyString,
    name: Type.Optional(NonEmptyString),
    identity: Type.Optional(
      Type.Object(
        {
          name: Type.Optional(NonEmptyString),
          theme: Type.Optional(NonEmptyString),
          emoji: Type.Optional(NonEmptyString),
          avatar: Type.Optional(NonEmptyString),
          avatarUrl: Type.Optional(NonEmptyString),
        },
        { additionalProperties: false },
      ),
    ),
  },
  { additionalProperties: false },
);

export const AgentsListParamsSchema = Type.Object({}, { additionalProperties: false });

export const AgentsListResultSchema = Type.Object(
  {
    defaultId: NonEmptyString,
    mainKey: NonEmptyString,
    scope: Type.Union([Type.Literal("per-sender"), Type.Literal("global")]),
    agents: Type.Array(AgentSummarySchema),
  },
  { additionalProperties: false },
);

export const AgentsCreateParamsSchema = Type.Object(
  {
    name: NonEmptyString,
    workspace: NonEmptyString,
    emoji: Type.Optional(Type.String()),
    avatar: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export const AgentsCreateResultSchema = Type.Object(
  {
    ok: Type.Literal(true),
    agentId: NonEmptyString,
    name: NonEmptyString,
    workspace: NonEmptyString,
  },
  { additionalProperties: false },
);

export const AgentsUpdateParamsSchema = Type.Object(
  {
    agentId: NonEmptyString,
    name: Type.Optional(NonEmptyString),
    workspace: Type.Optional(NonEmptyString),
    model: Type.Optional(NonEmptyString),
    avatar: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export const AgentsUpdateResultSchema = Type.Object(
  {
    ok: Type.Literal(true),
    agentId: NonEmptyString,
  },
  { additionalProperties: false },
);

export const AgentsDeleteParamsSchema = Type.Object(
  {
    agentId: NonEmptyString,
    deleteFiles: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);

export const AgentsDeleteResultSchema = Type.Object(
  {
    ok: Type.Literal(true),
    agentId: NonEmptyString,
    removedBindings: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
);

export const AgentsFileEntrySchema = Type.Object(
  {
    name: NonEmptyString,
    path: NonEmptyString,
    missing: Type.Boolean(),
    size: Type.Optional(Type.Integer({ minimum: 0 })),
    updatedAtMs: Type.Optional(Type.Integer({ minimum: 0 })),
    content: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export const AgentsFilesListParamsSchema = Type.Object(
  {
    agentId: NonEmptyString,
  },
  { additionalProperties: false },
);

export const AgentsFilesListResultSchema = Type.Object(
  {
    agentId: NonEmptyString,
    workspace: NonEmptyString,
    files: Type.Array(AgentsFileEntrySchema),
  },
  { additionalProperties: false },
);

export const AgentsFilesGetParamsSchema = Type.Object(
  {
    agentId: NonEmptyString,
    name: NonEmptyString,
  },
  { additionalProperties: false },
);

export const AgentsFilesGetResultSchema = Type.Object(
  {
    agentId: NonEmptyString,
    workspace: NonEmptyString,
    file: AgentsFileEntrySchema,
  },
  { additionalProperties: false },
);

export const AgentsFilesSetParamsSchema = Type.Object(
  {
    agentId: NonEmptyString,
    name: NonEmptyString,
    content: Type.String(),
  },
  { additionalProperties: false },
);

export const AgentsFilesSetResultSchema = Type.Object(
  {
    ok: Type.Literal(true),
    agentId: NonEmptyString,
    workspace: NonEmptyString,
    file: AgentsFileEntrySchema,
  },
  { additionalProperties: false },
);

export const ModelsListParamsSchema = Type.Object({}, { additionalProperties: false });

export const ModelsListResultSchema = Type.Object(
  {
    models: Type.Array(ModelChoiceSchema),
  },
  { additionalProperties: false },
);

export const ModelsConfiguredParamsSchema = Type.Object({}, { additionalProperties: false });

const ConfiguredModelSourceSchema = Type.Union([
  Type.Literal("config"),
  Type.Literal("agent-models"),
  Type.Literal("mixed"),
  Type.Literal("runtime"),
]);

const ProviderScopeSchema = Type.Union([Type.Literal("global"), NonEmptyString]);

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
        source: ConfiguredModelSourceSchema,
        scope: ProviderScopeSchema,
        editable: Type.Boolean(),
      }),
    ),
  },
  { additionalProperties: false },
);

export const SkillsStatusParamsSchema = Type.Object(
  {
    agentId: Type.Optional(NonEmptyString),
  },
  { additionalProperties: false },
);

export const SkillsBinsParamsSchema = Type.Object({}, { additionalProperties: false });

export const SkillsBinsResultSchema = Type.Object(
  {
    bins: Type.Array(NonEmptyString),
  },
  { additionalProperties: false },
);

export const SkillsInstallParamsSchema = Type.Union([
  Type.Object(
    {
      name: NonEmptyString,
      installId: NonEmptyString,
      timeoutMs: Type.Optional(Type.Integer({ minimum: 1000 })),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      source: Type.Literal("clawhub"),
      slug: NonEmptyString,
      version: Type.Optional(NonEmptyString),
      force: Type.Optional(Type.Boolean()),
      timeoutMs: Type.Optional(Type.Integer({ minimum: 1000 })),
    },
    { additionalProperties: false },
  ),
]);

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

export const SkillsUpdateParamsSchema = Type.Union([
  Type.Object(
    {
      skillKey: NonEmptyString,
      enabled: Type.Optional(Type.Boolean()),
      apiKey: Type.Optional(Type.String()),
      env: Type.Optional(Type.Record(NonEmptyString, Type.String())),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      source: Type.Literal("clawhub"),
      slug: Type.Optional(NonEmptyString),
      all: Type.Optional(Type.Boolean()),
    },
    { additionalProperties: false },
  ),
]);

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

export const ToolsCatalogParamsSchema = Type.Object(
  {
    agentId: Type.Optional(NonEmptyString),
    includePlugins: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);

export const ToolsEffectiveParamsSchema = Type.Object(
  {
    agentId: Type.Optional(NonEmptyString),
    sessionKey: NonEmptyString,
  },
  { additionalProperties: false },
);

export const ToolCatalogProfileSchema = Type.Object(
  {
    id: Type.Union([
      Type.Literal("minimal"),
      Type.Literal("coding"),
      Type.Literal("messaging"),
      Type.Literal("full"),
    ]),
    label: NonEmptyString,
  },
  { additionalProperties: false },
);

export const ToolCatalogEntrySchema = Type.Object(
  {
    id: NonEmptyString,
    label: NonEmptyString,
    description: Type.String(),
    source: Type.Union([Type.Literal("core"), Type.Literal("plugin")]),
    pluginId: Type.Optional(NonEmptyString),
    optional: Type.Optional(Type.Boolean()),
    defaultProfiles: Type.Array(
      Type.Union([
        Type.Literal("minimal"),
        Type.Literal("coding"),
        Type.Literal("messaging"),
        Type.Literal("full"),
      ]),
    ),
  },
  { additionalProperties: false },
);

export const ToolCatalogGroupSchema = Type.Object(
  {
    id: NonEmptyString,
    label: NonEmptyString,
    source: Type.Union([Type.Literal("core"), Type.Literal("plugin")]),
    pluginId: Type.Optional(NonEmptyString),
    tools: Type.Array(ToolCatalogEntrySchema),
  },
  { additionalProperties: false },
);

export const ToolsCatalogResultSchema = Type.Object(
  {
    agentId: NonEmptyString,
    profiles: Type.Array(ToolCatalogProfileSchema),
    groups: Type.Array(ToolCatalogGroupSchema),
  },
  { additionalProperties: false },
);

export const ToolsEffectiveEntrySchema = Type.Object(
  {
    id: NonEmptyString,
    label: NonEmptyString,
    description: Type.String(),
    rawDescription: Type.String(),
    source: Type.Union([Type.Literal("core"), Type.Literal("plugin"), Type.Literal("channel")]),
    pluginId: Type.Optional(NonEmptyString),
    channelId: Type.Optional(NonEmptyString),
  },
  { additionalProperties: false },
);

export const ToolsEffectiveGroupSchema = Type.Object(
  {
    id: Type.Union([Type.Literal("core"), Type.Literal("plugin"), Type.Literal("channel")]),
    label: NonEmptyString,
    source: Type.Union([Type.Literal("core"), Type.Literal("plugin"), Type.Literal("channel")]),
    tools: Type.Array(ToolsEffectiveEntrySchema),
  },
  { additionalProperties: false },
);

export const ToolsEffectiveResultSchema = Type.Object(
  {
    agentId: NonEmptyString,
    profile: NonEmptyString,
    groups: Type.Array(ToolsEffectiveGroupSchema),
  },
  { additionalProperties: false },
);

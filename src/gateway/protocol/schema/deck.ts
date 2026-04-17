import { Type } from "@sinclair/typebox";
import { NonEmptyString } from "./primitives.js";
import { WizardSpecSchema } from "./wizard-spec.js";

const ChatType = Type.Union([
  Type.Literal("direct"),
  Type.Literal("group"),
  Type.Literal("channel"),
]);
const PeerSchema = Type.Object(
  { kind: ChatType, id: NonEmptyString },
  { additionalProperties: false },
);

// === deck.routing.* ===
export const DeckRoutingListParamsSchema = Type.Object(
  {
    agentId: Type.Optional(NonEmptyString),
    channel: Type.Optional(NonEmptyString),
    accountId: Type.Optional(NonEmptyString),
  },
  { additionalProperties: false },
);

export const DeckRoutingAddParamsSchema = Type.Object(
  {
    agentId: NonEmptyString,
    match: Type.Object(
      {
        channel: NonEmptyString,
        accountId: Type.Optional(Type.String()),
        peer: Type.Optional(PeerSchema),
        guildId: Type.Optional(Type.String()),
        roles: Type.Optional(Type.Array(Type.String())),
        teamId: Type.Optional(Type.String()),
      },
      { additionalProperties: false },
    ),
    comment: Type.Optional(Type.String()),
    position: Type.Optional(Type.Integer({ minimum: 0 })),
    baseHash: NonEmptyString,
  },
  { additionalProperties: false },
);

export const DeckRoutingRemoveParamsSchema = Type.Object(
  {
    id: NonEmptyString,
    baseHash: NonEmptyString,
  },
  { additionalProperties: false },
);

export const DeckRoutingValidateParamsSchema = Type.Object(
  {
    agentId: NonEmptyString,
    match: Type.Object(
      {
        channel: NonEmptyString,
        accountId: Type.Optional(Type.String()),
        peer: Type.Optional(PeerSchema),
        guildId: Type.Optional(Type.String()),
        roles: Type.Optional(Type.Array(Type.String())),
        teamId: Type.Optional(Type.String()),
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
);

export const DeckRoutingSimulateParamsSchema = Type.Object(
  {
    channel: NonEmptyString,
    accountId: Type.Optional(Type.String()),
    peer: Type.Optional(PeerSchema),
    guildId: Type.Optional(Type.String()),
    teamId: Type.Optional(Type.String()),
    memberRoleIds: Type.Optional(Type.Array(Type.String())),
  },
  { additionalProperties: false },
);

// === deck.agents.* ===
export const DeckAgentsDetailParamsSchema = Type.Object(
  {
    agentId: NonEmptyString,
  },
  { additionalProperties: false },
);

export const DeckAgentsSkillsGetParamsSchema = Type.Object(
  {
    agentId: NonEmptyString,
  },
  { additionalProperties: false },
);

export const DeckAgentsSkillsSetParamsSchema = Type.Object(
  {
    agentId: NonEmptyString,
    mode: Type.Union([Type.Literal("all"), Type.Literal("whitelist")]),
    skills: Type.Array(Type.String()),
    baseHash: NonEmptyString,
  },
  { additionalProperties: false },
);

export const DeckAgentsSubagentsGetParamsSchema = Type.Object(
  {
    agentId: NonEmptyString,
  },
  { additionalProperties: false },
);

export const DeckAgentsSubagentsSetParamsSchema = Type.Object(
  {
    agentId: NonEmptyString,
    allowAgents: Type.Array(Type.String()),
    model: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    baseHash: NonEmptyString,
  },
  { additionalProperties: false },
);

// === deck.agents.eventStreams.* ===
export const DeckAgentsEventStreamsGetParamsSchema = Type.Object(
  {
    agentId: NonEmptyString,
  },
  { additionalProperties: false },
);

export const DeckAgentsEventStreamsSetParamsSchema = Type.Object(
  {
    agentId: NonEmptyString,
    eventStreams: Type.Array(Type.String()),
    baseHash: NonEmptyString,
  },
  { additionalProperties: false },
);

// === deck.agents.toolPolicy.* ===
export const DeckAgentsToolPolicyPreviewParamsSchema = Type.Object(
  {
    agentId: NonEmptyString,
    context: Type.Optional(
      Type.Object({
        channel: Type.Optional(Type.String()),
        chatType: Type.Optional(Type.String()),
      }),
    ),
  },
  { additionalProperties: false },
);

// === deck.agents.systemPrompt.* ===
export const DeckAgentsSystemPromptPreviewParamsSchema = Type.Object(
  {
    agentId: NonEmptyString,
    context: Type.Optional(
      Type.Object({
        channel: Type.Optional(Type.String()),
        chatType: Type.Optional(Type.String()),
      }),
    ),
  },
  { additionalProperties: false },
);

// === deck.subagents.* ===
export const DeckSubagentsListParamsSchema = Type.Object(
  {
    status: Type.Optional(
      Type.Union([
        Type.Literal("active"),
        Type.Literal("completed"),
        Type.Literal("failed"),
        Type.Literal("timeout"),
        Type.Literal("all"),
      ]),
    ),
    agentId: Type.Optional(NonEmptyString),
    requesterAgentId: Type.Optional(NonEmptyString),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 200 })),
    offset: Type.Optional(Type.Integer({ minimum: 0 })),
  },
  { additionalProperties: false },
);

export const DeckSubagentsKillParamsSchema = Type.Object(
  {
    runId: NonEmptyString,
  },
  { additionalProperties: false },
);

export const DeckSubagentsLineageParamsSchema = Type.Object(
  {
    runId: Type.Optional(NonEmptyString),
    sessionKey: Type.Optional(NonEmptyString),
  },
  { additionalProperties: false },
);

export const DeckSubagentsSteerParamsSchema = Type.Object(
  {
    runId: NonEmptyString,
    instruction: NonEmptyString,
  },
  { additionalProperties: false },
);

// === deck.identity.* ===
export const DeckIdentityListParamsSchema = Type.Object({}, { additionalProperties: false });

export const DeckIdentityLinkParamsSchema = Type.Object(
  {
    canonical: NonEmptyString,
    channel: NonEmptyString,
    peerId: NonEmptyString,
    baseHash: NonEmptyString,
  },
  { additionalProperties: false },
);

export const DeckIdentityUnlinkParamsSchema = Type.Object(
  {
    canonical: NonEmptyString,
    channel: NonEmptyString,
    peerId: NonEmptyString,
    baseHash: NonEmptyString,
  },
  { additionalProperties: false },
);

// === deck.threads.* ===
export const DeckThreadsListParamsSchema = Type.Object(
  {
    agentId: Type.Optional(NonEmptyString),
    channel: Type.Optional(NonEmptyString),
    status: Type.Optional(Type.Union([Type.Literal("active"), Type.Literal("all")])),
  },
  { additionalProperties: false },
);

// === deck.plugins.* ===
export const DeckPluginsListParamsSchema = Type.Object(
  {
    capability: Type.Optional(Type.Union([Type.Literal("channel"), Type.Literal("all")])),
  },
  { additionalProperties: false },
);

// ============================================================
// Result schemas — derived from handler respond(true, {...}) calls
// ============================================================

// --- shared helpers ---

const EnrichedBindingSchema = Type.Object({
  id: Type.String(),
  agentId: Type.String(),
  tier: Type.String(),
  match: Type.Object({
    channel: Type.String(),
    accountId: Type.Optional(Type.String()),
    peer: Type.Optional(Type.Object({ kind: Type.String(), id: Type.String() })),
    guildId: Type.Optional(Type.String()),
    roles: Type.Optional(Type.Array(Type.String())),
    teamId: Type.Optional(Type.String()),
  }),
  comment: Type.Optional(Type.String()),
});

const ConflictEntrySchema = Type.Object({
  type: Type.String(),
  bindingId: Type.String(),
  agentId: Type.String(),
  detail: Type.String(),
});

// === deck.routing.* results ===

export const DeckRoutingListResultSchema = Type.Object({
  bindings: Type.Array(EnrichedBindingSchema),
  defaultAgentId: Type.String(),
  dmScope: Type.String(),
  configHash: Type.String(),
});

export const DeckRoutingAddResultSchema = Type.Object({
  ok: Type.Boolean(),
  binding: EnrichedBindingSchema,
  configHash: Type.String(),
  warnings: Type.Array(ConflictEntrySchema),
});

export const DeckRoutingRemoveResultSchema = Type.Object({
  ok: Type.Boolean(),
  removed: EnrichedBindingSchema,
  configHash: Type.String(),
  impact: Type.String(),
});

export const DeckRoutingValidateResultSchema = Type.Object({
  ok: Type.Boolean(),
  tier: Type.String(),
  conflicts: Type.Array(ConflictEntrySchema),
});

const SimulationTierSchema = Type.Object({
  tier: Type.String(),
  matched: Type.Boolean(),
  checked: Type.Boolean(),
});

export const DeckRoutingSimulateResultSchema = Type.Object({
  agentId: Type.String(),
  matchedBy: Type.String(),
  sessionKey: Type.String(),
  tiers: Type.Array(SimulationTierSchema),
});

// === deck.agents.* results ===

export const DeckAgentsDetailResultSchema = Type.Object({
  id: Type.String(),
  name: Type.Optional(Type.String()),
  workspace: Type.String(),
  model: Type.Optional(Type.String()),
  reasoningDefault: Type.Optional(
    Type.Union([Type.Literal("on"), Type.Literal("off"), Type.Literal("stream")]),
  ),
  fastModeDefault: Type.Optional(Type.Boolean()),
  isDefault: Type.Boolean(),
  bindingCount: Type.Integer(),
  sessionCount: Type.Integer(),
  activeSubagentCount: Type.Integer(),
  skillMode: Type.String(),
  effectiveSkills: Type.Array(Type.String()),
  totalAvailableSkills: Type.Integer(),
  subagents: Type.Object({
    allowAgents: Type.Array(Type.String()),
    model: Type.Optional(Type.String()),
    effectiveMaxSpawnDepth: Type.Integer(),
    effectiveMaxChildrenPerAgent: Type.Integer(),
  }),
  sandbox: Type.Optional(Type.Unknown()),
  identityExists: Type.Boolean(),
  fallbackModels: Type.Optional(Type.Array(Type.String())),
});

const AvailableSkillSchema = Type.Object({
  key: Type.String(),
  name: Type.String(),
  eligible: Type.Boolean(),
  assigned: Type.Boolean(),
});

export const DeckAgentsSkillsGetResultSchema = Type.Object({
  agentId: Type.String(),
  mode: Type.String(),
  skills: Type.Array(Type.String()),
  available: Type.Array(AvailableSkillSchema),
  configHash: Type.String(),
});

export const DeckAgentsSkillsSetResultSchema = Type.Object({
  ok: Type.Boolean(),
  agentId: Type.String(),
  mode: Type.String(),
  skills: Type.Array(Type.String()),
  configHash: Type.String(),
});

const AgentEntrySchema = Type.Object({
  id: Type.String(),
  name: Type.Optional(Type.String()),
});

export const DeckAgentsSubagentsGetResultSchema = Type.Object({
  agentId: Type.String(),
  allowAgents: Type.Array(Type.String()),
  allowAny: Type.Boolean(),
  model: Type.Optional(Type.String()),
  effectiveMaxSpawnDepth: Type.Integer(),
  effectiveMaxChildrenPerAgent: Type.Integer(),
  effectiveThinking: Type.Optional(Type.Unknown()),
  allowedAgents: Type.Array(AgentEntrySchema),
  allAgents: Type.Array(AgentEntrySchema),
  configHash: Type.String(),
});

export const DeckAgentsSubagentsSetResultSchema = Type.Object({
  ok: Type.Boolean(),
  agentId: Type.String(),
  allowAgents: Type.Array(Type.String()),
  model: Type.Optional(Type.String()),
  configHash: Type.String(),
});

export const DeckAgentsEventStreamsGetResultSchema = Type.Object({
  agentId: Type.String(),
  eventStreams: Type.Array(Type.String()),
  isDefault: Type.Boolean(),
  configHash: Type.String(),
});

export const DeckAgentsEventStreamsSetResultSchema = Type.Object({
  ok: Type.Boolean(),
  agentId: Type.String(),
  eventStreams: Type.Array(Type.String()),
  configHash: Type.String(),
});

// === deck.agents preview results ===

const ToolPolicyLayerSchema = Type.Object({
  label: Type.String(),
  ruleCount: Type.Integer(),
  effect: Type.String(),
});

const ToolPolicyToolSchema = Type.Object({
  name: Type.String(),
  allowed: Type.Boolean(),
  decisiveLayer: Type.String(),
  trace: Type.Array(
    Type.Object({
      layer: Type.String(),
      decision: Type.String(),
    }),
  ),
});

export const DeckAgentsToolPolicyPreviewResultSchema = Type.Object({
  layers: Type.Array(ToolPolicyLayerSchema),
  tools: Type.Array(ToolPolicyToolSchema),
  configHash: Type.String(),
});

const PromptLayerSchema = Type.Object({
  label: Type.String(),
  source: Type.String(),
  charCount: Type.Integer(),
  fileCount: Type.Integer(),
});

const BootstrapFileStatSchema = Type.Object({
  name: Type.String(),
  exists: Type.Boolean(),
  charCount: Type.Integer(),
});

export const DeckAgentsSystemPromptPreviewResultSchema = Type.Object({
  layers: Type.Array(PromptLayerSchema),
  bootstrapFiles: Type.Array(BootstrapFileStatSchema),
  totalChars: Type.Integer(),
  configHash: Type.String(),
});

// === deck.subagents.* results ===

const SubagentRunSchema = Type.Object({
  runId: Type.String(),
  childSessionKey: Type.String(),
  childAgentId: Type.String(),
  childAgentName: Type.Optional(Type.String()),
  requesterSessionKey: Type.String(),
  requesterAgentId: Type.String(),
  requesterAgentName: Type.Optional(Type.String()),
  task: Type.Optional(Type.String()),
  label: Type.Optional(Type.String()),
  model: Type.Optional(Type.String()),
  spawnMode: Type.String(),
  depth: Type.Integer(),
  createdAt: Type.Number(),
  startedAt: Type.Optional(Type.Number()),
  endedAt: Type.Optional(Type.Number()),
  durationMs: Type.Optional(Type.Number()),
  status: Type.String(),
  outcome: Type.Optional(Type.Unknown()),
});

export const DeckSubagentsListResultSchema = Type.Object({
  runs: Type.Array(SubagentRunSchema),
  total: Type.Integer(),
});

export const DeckSubagentsKillResultSchema = Type.Object({
  ok: Type.Boolean(),
  runId: Type.String(),
  childSessionKey: Type.String(),
});

const LineageNodeSchema = Type.Object({
  runId: Type.String(),
  sessionKey: Type.String(),
  agentId: Type.String(),
  agentName: Type.Optional(Type.String()),
  task: Type.Optional(Type.String()),
  depth: Type.Integer(),
  parentRunId: Type.Union([Type.String(), Type.Null()]),
  status: Type.String(),
  durationMs: Type.Optional(Type.Number()),
});

export const DeckSubagentsLineageResultSchema = Type.Object({
  root: Type.Object({
    sessionKey: Type.String(),
    agentId: Type.String(),
    agentName: Type.Optional(Type.String()),
  }),
  nodes: Type.Array(LineageNodeSchema),
});

export const DeckSubagentsSteerResultSchema = Type.Object({
  success: Type.Boolean(),
  dedupKey: Type.Optional(Type.String()),
  deduped: Type.Optional(Type.Boolean()),
  newRunId: Type.Optional(Type.String()),
});

// === deck.identity.* results ===

const IdentityLinkSchema = Type.Object({
  canonical: Type.String(),
  peers: Type.Array(
    Type.Object({
      channel: Type.String(),
      peerId: Type.String(),
    }),
  ),
});

export const DeckIdentityListResultSchema = Type.Object({
  links: Type.Array(IdentityLinkSchema),
  configHash: Type.String(),
});

export const DeckIdentityLinkResultSchema = Type.Object({
  ok: Type.Boolean(),
  configHash: Type.String(),
});

export const DeckIdentityUnlinkResultSchema = Type.Object({
  ok: Type.Boolean(),
  configHash: Type.String(),
});

// === deck.threads.* results ===

const ThreadBindingSchema = Type.Object({
  threadId: Type.String(),
  channelId: Type.String(),
  agentId: Type.String(),
  targetSessionKey: Type.String(),
  targetKind: Type.String(),
  boundAt: Type.Number(),
  lastActivityAt: Type.Number(),
  accountId: Type.String(),
  boundBy: Type.String(),
  label: Type.Optional(Type.String()),
});

export const DeckThreadsListResultSchema = Type.Object({
  threads: Type.Array(ThreadBindingSchema),
});

// === deck.plugins.* results ===

const DeckPluginInventoryEntrySchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  version: Type.Optional(Type.String()),
  origin: Type.String(),
  status: Type.String(),
  enabled: Type.Boolean(),
  explicitlyEnabled: Type.Optional(Type.Boolean()),
  activated: Type.Optional(Type.Boolean()),
  imported: Type.Optional(Type.Boolean()),
  activationSource: Type.Optional(Type.String()),
  activationReason: Type.Optional(Type.String()),
  configPath: Type.String(),
  capabilityKinds: Type.Array(Type.String()),
  channelIds: Type.Array(Type.String()),
  providerIds: Type.Array(Type.String()),
  toolNames: Type.Array(Type.String()),
  setupWizardSpec: Type.Optional(WizardSpecSchema),
  diagnostics: Type.Array(
    Type.Object(
      {
        level: Type.String(),
        message: Type.String(),
      },
      { additionalProperties: false },
    ),
  ),
});

export const DeckPluginsListResultSchema = Type.Object({
  scope: Type.String(),
  plugins: Type.Array(DeckPluginInventoryEntrySchema),
});

// === deck.auth.* results ===
// NOTE: handlers in src/gateway/server-methods/deck-auth.ts (NOT in deck/ subdir)

const AuthOverviewProviderSchema = Type.Object({
  provider: Type.String(),
  status: Type.String(),
  source: Type.Union([
    Type.Literal("config"),
    Type.Literal("auth-profile"),
    Type.Literal("agent-models"),
    Type.Literal("env"),
    Type.Literal("mixed"),
  ]),
  scope: Type.Union([Type.Literal("global"), NonEmptyString]),
  configPresent: Type.Boolean(),
  authPresent: Type.Boolean(),
  editable: Type.Boolean(),
  auth: Type.Union([
    Type.Object({
      type: Type.Union([Type.String(), Type.Null()]),
      source: Type.String(),
      profileId: Type.Optional(Type.String()),
    }),
    Type.Null(),
  ]),
  oauth: Type.Optional(
    Type.Object({
      expiresAt: Type.Number(),
      remainingMs: Type.Number(),
      status: Type.String(),
    }),
  ),
  cooldown: Type.Optional(
    Type.Object({
      reason: Type.String(),
      remainingMs: Type.Number(),
      until: Type.Number(),
    }),
  ),
  usage: Type.Optional(
    Type.Object({
      windows: Type.Array(
        Type.Object({
          label: Type.String(),
          usedPercent: Type.Number(),
          resetsInMs: Type.Number(),
        }),
      ),
      plan: Type.Optional(Type.String()),
    }),
  ),
});

export const DeckAuthOverviewResultSchema = Type.Object({
  providers: Type.Array(AuthOverviewProviderSchema),
});

export const DeckAuthProbeResultSchema = Type.Object({
  provider: Type.String(),
  model: Type.Optional(Type.String()),
  profileId: Type.Optional(Type.String()),
  label: Type.String(),
  source: Type.String(),
  mode: Type.Optional(Type.String()),
  status: Type.String(),
  reasonCode: Type.Optional(Type.String()),
  error: Type.Optional(Type.String()),
  latencyMs: Type.Optional(Type.Number()),
});

// === deck.commands.* ===
export const DeckCommandsDiscoverParamsSchema = Type.Object(
  {
    agentId: Type.Optional(NonEmptyString),
  },
  { additionalProperties: false },
);

const DeckDiscoverableCommandSourceSchema = Type.Union([
  Type.Literal("builtin"),
  Type.Literal("skill"),
  Type.Literal("plugin"),
]);

const DiscoverableCommandSchema = Type.Object({
  name: Type.String(),
  source: DeckDiscoverableCommandSourceSchema,
  description: Type.String(),
  args: Type.Optional(Type.String()),
  argChoices: Type.Optional(Type.Array(Type.String())),
  category: Type.Optional(Type.String()),
  skillName: Type.Optional(Type.String()),
  pluginId: Type.Optional(Type.String()),
});

export const DeckCommandsDiscoverResultSchema = Type.Object({
  commands: Type.Array(DiscoverableCommandSchema),
  version: Type.String(),
});

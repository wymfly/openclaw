import { Type } from "@sinclair/typebox";
import { NonEmptyString } from "./primitives.js";

// ---------------------------------------------------------------------------
// health — HealthSummary result schema
// The health snapshot is deeply nested with dynamic channel data, so we model
// the top-level shape loosely while keeping the contract stable for codegen.
// ---------------------------------------------------------------------------

export const HealthResultSchema = Type.Object(
  {
    ok: Type.Literal(true),
    ts: Type.Number(),
    durationMs: Type.Number(),
    channels: Type.Record(Type.String(), Type.Unknown()),
    channelOrder: Type.Array(Type.String()),
    channelLabels: Type.Record(Type.String(), Type.String()),
    heartbeatSeconds: Type.Number(),
    defaultAgentId: Type.String(),
    agents: Type.Array(Type.Unknown()),
    sessions: Type.Object(
      {
        path: Type.String(),
        count: Type.Number(),
        recent: Type.Array(Type.Unknown()),
      },
      { additionalProperties: true },
    ),
  },
  { additionalProperties: true },
);

// ---------------------------------------------------------------------------
// status — StatusSummary result schema
// Complex nested structure; keep top-level shape typed, internals loose.
// ---------------------------------------------------------------------------

export const StatusResultSchema = Type.Object(
  {
    runtimeVersion: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    linkChannel: Type.Optional(
      Type.Object(
        {
          id: Type.String(),
          label: Type.String(),
          linked: Type.Boolean(),
          authAgeMs: Type.Union([Type.Number(), Type.Null()]),
        },
        { additionalProperties: false },
      ),
    ),
    heartbeat: Type.Object(
      {
        defaultAgentId: Type.String(),
        agents: Type.Array(Type.Unknown()),
      },
      { additionalProperties: true },
    ),
    channelSummary: Type.Array(Type.String()),
    queuedSystemEvents: Type.Array(Type.String()),
    sessions: Type.Object(
      {
        paths: Type.Array(Type.String()),
        count: Type.Number(),
        defaults: Type.Object(
          {
            model: Type.Union([Type.String(), Type.Null()]),
            contextTokens: Type.Union([Type.Number(), Type.Null()]),
          },
          { additionalProperties: false },
        ),
        recent: Type.Array(Type.Unknown()),
        byAgent: Type.Array(Type.Unknown()),
      },
      { additionalProperties: true },
    ),
  },
  { additionalProperties: true },
);

// ---------------------------------------------------------------------------
// doctor.memory.status — DoctorMemoryStatusPayload
// ---------------------------------------------------------------------------

export const DoctorMemoryStatusResultSchema = Type.Object(
  {
    agentId: Type.String(),
    provider: Type.Optional(Type.String()),
    embedding: Type.Object(
      {
        ok: Type.Boolean(),
        error: Type.Optional(Type.String()),
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
);

// ---------------------------------------------------------------------------
// doctor.memory.dreamDiary — DoctorMemoryDreamDiaryPayload
// ---------------------------------------------------------------------------

export const DoctorMemoryDreamDiaryResultSchema = Type.Object(
  {
    agentId: Type.String(),
    found: Type.Boolean(),
    path: Type.String(),
    content: Type.Optional(Type.String()),
    updatedAtMs: Type.Optional(Type.Integer({ minimum: 0 })),
  },
  { additionalProperties: false },
);

// ---------------------------------------------------------------------------
// doctor.memory dream actions — DoctorMemoryDreamActionPayload
// Used by: backfillDreamDiary, resetDreamDiary, resetGroundedShortTerm,
//          repairDreamingArtifacts, dedupeDreamDiary
// ---------------------------------------------------------------------------

export const DoctorMemoryDreamActionResultSchema = Type.Object(
  {
    agentId: Type.String(),
    action: Type.String(),
    path: Type.Optional(Type.String()),
    found: Type.Optional(Type.Boolean()),
    scannedFiles: Type.Optional(Type.Integer({ minimum: 0 })),
    written: Type.Optional(Type.Integer({ minimum: 0 })),
    replaced: Type.Optional(Type.Integer({ minimum: 0 })),
    removedEntries: Type.Optional(Type.Integer({ minimum: 0 })),
    removedShortTermEntries: Type.Optional(Type.Integer({ minimum: 0 })),
    changed: Type.Optional(Type.Boolean()),
    archiveDir: Type.Optional(Type.String()),
    archivedDreamsDiary: Type.Optional(Type.Boolean()),
    archivedSessionCorpus: Type.Optional(Type.Boolean()),
    archivedSessionIngestion: Type.Optional(Type.Boolean()),
    warnings: Type.Optional(Type.Array(Type.String())),
    dedupedEntries: Type.Optional(Type.Integer({ minimum: 0 })),
    keptEntries: Type.Optional(Type.Integer({ minimum: 0 })),
  },
  { additionalProperties: false },
);

// ---------------------------------------------------------------------------
// models.catalog.providers — catalog provider list
// ---------------------------------------------------------------------------

const CatalogProviderModelSchema = Type.Object(
  {
    id: Type.String(),
    name: Type.String(),
    contextWindow: Type.Number(),
    reasoning: Type.Boolean(),
    maxTokens: Type.Number(),
  },
  { additionalProperties: false },
);

const CatalogProviderEntrySchema = Type.Object(
  {
    id: Type.String(),
    displayName: Type.String(),
    modelCount: Type.Number(),
    defaultBaseUrl: Type.String(),
    authType: Type.String(),
    api: Type.String(),
    models: Type.Array(CatalogProviderModelSchema),
  },
  { additionalProperties: false },
);

export const ModelsCatalogProvidersResultSchema = Type.Object(
  {
    providers: Type.Array(CatalogProviderEntrySchema),
  },
  { additionalProperties: false },
);

// ---------------------------------------------------------------------------
// channels.logout — ChannelLogoutPayload
// ---------------------------------------------------------------------------

export const ChannelsLogoutResultSchema = Type.Object(
  {
    channel: NonEmptyString,
    accountId: Type.String(),
    cleared: Type.Boolean(),
  },
  { additionalProperties: true },
);

import { Type } from "@sinclair/typebox";
import { NonEmptyString, SessionLabelString } from "./primitives.js";

export const SessionCompactionCheckpointReasonSchema = Type.Union([
  Type.Literal("manual"),
  Type.Literal("auto-threshold"),
  Type.Literal("overflow-retry"),
  Type.Literal("timeout-retry"),
]);

export const SessionCompactionTranscriptReferenceSchema = Type.Object(
  {
    sessionId: NonEmptyString,
    sessionFile: Type.Optional(NonEmptyString),
    leafId: Type.Optional(NonEmptyString),
    entryId: Type.Optional(NonEmptyString),
  },
  { additionalProperties: false },
);

const ThreadIdSchema = Type.Union([Type.String(), Type.Number()]);

export const SessionCompactionCheckpointReasonSchema = Type.Union([
  Type.Literal("manual"),
  Type.Literal("auto-threshold"),
  Type.Literal("overflow-retry"),
  Type.Literal("timeout-retry"),
]);

export const DeliveryContextSchema = Type.Object(
  {
    channel: Type.Optional(Type.String()),
    to: Type.Optional(Type.String()),
    accountId: Type.Optional(Type.String()),
    threadId: Type.Optional(ThreadIdSchema),
  },
  { additionalProperties: false },
);

export const SessionCompactionCheckpointSchema = Type.Object(
  {
    checkpointId: NonEmptyString,
    sessionKey: NonEmptyString,
    sessionId: NonEmptyString,
    createdAt: Type.Integer({ minimum: 0 }),
    reason: SessionCompactionCheckpointReasonSchema,
    tokensBefore: Type.Optional(Type.Integer({ minimum: 0 })),
    tokensAfter: Type.Optional(Type.Integer({ minimum: 0 })),
    summary: Type.Optional(Type.String()),
    firstKeptEntryId: Type.Optional(NonEmptyString),
    preCompaction: SessionCompactionTranscriptReferenceSchema,
    postCompaction: SessionCompactionTranscriptReferenceSchema,
  },
  { additionalProperties: false },
);

export const GatewaySessionRowSchema = Type.Object(
  {
    key: NonEmptyString,
    spawnedBy: Type.Optional(Type.String()),
    kind: Type.Union([
      Type.Literal("direct"),
      Type.Literal("group"),
      Type.Literal("global"),
      Type.Literal("unknown"),
    ]),
    label: Type.Optional(Type.String()),
    displayName: Type.Optional(Type.String()),
    derivedTitle: Type.Optional(Type.String()),
    lastMessagePreview: Type.Optional(Type.String()),
    channel: Type.Optional(Type.String()),
    subject: Type.Optional(Type.String()),
    groupChannel: Type.Optional(Type.String()),
    space: Type.Optional(Type.String()),
    chatType: Type.Optional(Type.String()),
    origin: Type.Optional(Type.Unknown()),
    updatedAt: Type.Union([Type.Number(), Type.Null()]),
    sessionId: Type.Optional(Type.String()),
    systemSent: Type.Optional(Type.Boolean()),
    abortedLastRun: Type.Optional(Type.Boolean()),
    thinkingLevel: Type.Optional(Type.String()),
    fastMode: Type.Optional(Type.Boolean()),
    verboseLevel: Type.Optional(Type.String()),
    reasoningLevel: Type.Optional(Type.String()),
    elevatedLevel: Type.Optional(Type.String()),
    sendPolicy: Type.Optional(Type.Union([Type.Literal("allow"), Type.Literal("deny")])),
    inputTokens: Type.Optional(Type.Number()),
    outputTokens: Type.Optional(Type.Number()),
    totalTokens: Type.Optional(Type.Number()),
    totalTokensFresh: Type.Optional(Type.Boolean()),
    estimatedCostUsd: Type.Optional(Type.Number()),
    status: Type.Optional(
      Type.Union([
        Type.Literal("running"),
        Type.Literal("done"),
        Type.Literal("failed"),
        Type.Literal("killed"),
        Type.Literal("timeout"),
      ]),
    ),
    startedAt: Type.Optional(Type.Number()),
    endedAt: Type.Optional(Type.Number()),
    runtimeMs: Type.Optional(Type.Number()),
    parentSessionKey: Type.Optional(Type.String()),
    childSessions: Type.Optional(Type.Array(NonEmptyString)),
    responseUsage: Type.Optional(
      Type.Union([
        Type.Literal("on"),
        Type.Literal("off"),
        Type.Literal("tokens"),
        Type.Literal("full"),
      ]),
    ),
    modelProvider: Type.Optional(Type.String()),
    model: Type.Optional(Type.String()),
    contextTokens: Type.Optional(Type.Number()),
    deliveryContext: Type.Optional(DeliveryContextSchema),
    lastChannel: Type.Optional(Type.String()),
    lastTo: Type.Optional(Type.String()),
    lastAccountId: Type.Optional(Type.String()),
    compactionCount: Type.Optional(Type.Number()),
  },
  { additionalProperties: false },
);

export const SessionsDefaultsSchema = Type.Object(
  {
    modelProvider: Type.Union([Type.String(), Type.Null()]),
    model: Type.Union([Type.String(), Type.Null()]),
    contextTokens: Type.Union([Type.Number(), Type.Null()]),
  },
  { additionalProperties: false },
);

export const SessionEntryResultSchema = Type.Record(Type.String(), Type.Unknown());

export const SessionsSubscribeResultSchema = Type.Object(
  {
    subscribed: Type.Boolean(),
  },
  { additionalProperties: false },
);

export const SessionsMessagesSubscriptionResultSchema = Type.Object(
  {
    subscribed: Type.Boolean(),
    key: NonEmptyString,
  },
  { additionalProperties: false },
);

export const SessionPreviewItemSchema = Type.Object(
  {
    role: Type.Union([
      Type.Literal("user"),
      Type.Literal("assistant"),
      Type.Literal("tool"),
      Type.Literal("system"),
      Type.Literal("other"),
    ]),
    text: Type.String(),
  },
  { additionalProperties: false },
);

export const SessionsPreviewEntrySchema = Type.Object(
  {
    key: NonEmptyString,
    status: Type.Union([
      Type.Literal("ok"),
      Type.Literal("empty"),
      Type.Literal("missing"),
      Type.Literal("error"),
    ]),
    items: Type.Array(SessionPreviewItemSchema),
  },
  { additionalProperties: false },
);

export const SessionsPreviewResultSchema = Type.Object(
  {
    ts: Type.Number(),
    previews: Type.Array(SessionsPreviewEntrySchema),
  },
  { additionalProperties: false },
);

export const SessionsListResultSchema = Type.Object(
  {
    ts: Type.Number(),
    path: Type.String(),
    count: Type.Number(),
    defaults: SessionsDefaultsSchema,
    sessions: Type.Array(GatewaySessionRowSchema),
  },
  { additionalProperties: false },
);

export const SessionsResolveResultSchema = Type.Object(
  {
    ok: Type.Boolean(),
    key: NonEmptyString,
  },
  { additionalProperties: false },
);

export const SessionsGetParamsSchema = Type.Object(
  {
    key: Type.Optional(NonEmptyString),
    sessionKey: Type.Optional(NonEmptyString),
    limit: Type.Optional(Type.Integer({ minimum: 1 })),
  },
  { additionalProperties: false },
);

export const SessionsGetResultSchema = Type.Object(
  {
    messages: Type.Array(Type.Unknown()),
  },
  { additionalProperties: false },
);

export const SessionsCreateResultSchema = Type.Object(
  {
    ok: Type.Boolean(),
    key: NonEmptyString,
    sessionId: NonEmptyString,
    entry: SessionEntryResultSchema,
    runStarted: Type.Boolean(),
    runId: Type.Optional(NonEmptyString),
    status: Type.Optional(Type.String()),
    messageSeq: Type.Optional(Type.Integer({ minimum: 0 })),
    interruptedActiveRun: Type.Optional(Type.Boolean()),
    runError: Type.Optional(Type.Unknown()),
  },
  { additionalProperties: false },
);

export const SessionsSendResultSchema = Type.Object(
  {
    runId: Type.Optional(NonEmptyString),
    status: Type.Union([Type.Literal("started"), Type.Literal("in_flight")]),
    messageSeq: Type.Optional(Type.Integer({ minimum: 0 })),
    interruptedActiveRun: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);

export const SessionsAbortResultSchema = Type.Object(
  {
    ok: Type.Boolean(),
    abortedRunId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    status: Type.Union([Type.Literal("aborted"), Type.Literal("no-active-run")]),
  },
  { additionalProperties: false },
);

export const SessionsPatchResultSchema = Type.Object(
  {
    ok: Type.Literal(true),
    path: Type.String(),
    key: NonEmptyString,
    entry: SessionEntryResultSchema,
    resolved: Type.Optional(
      Type.Object(
        {
          modelProvider: Type.Optional(Type.String()),
          model: Type.Optional(Type.String()),
        },
        { additionalProperties: false },
      ),
    ),
  },
  { additionalProperties: false },
);

export const SessionsResetResultSchema = Type.Object(
  {
    ok: Type.Boolean(),
    key: NonEmptyString,
    entry: SessionEntryResultSchema,
  },
  { additionalProperties: false },
);

export const SessionsClearResultSchema = Type.Object(
  {
    ok: Type.Boolean(),
    key: NonEmptyString,
    entry: SessionEntryResultSchema,
  },
  { additionalProperties: false },
);

export const SessionsDeleteResultSchema = Type.Object(
  {
    ok: Type.Boolean(),
    key: NonEmptyString,
    deleted: Type.Boolean(),
    archived: Type.Array(Type.String()),
  },
  { additionalProperties: false },
);

export const SessionsCompactResultSchema = Type.Object(
  {
    ok: Type.Boolean(),
    key: NonEmptyString,
    compacted: Type.Boolean(),
    archived: Type.Optional(Type.Array(Type.String())),
    kept: Type.Optional(Type.Integer({ minimum: 0 })),
    reason: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export const SessionsListParamsSchema = Type.Object(
  {
    limit: Type.Optional(Type.Integer({ minimum: 1 })),
    activeMinutes: Type.Optional(Type.Integer({ minimum: 1 })),
    includeGlobal: Type.Optional(Type.Boolean()),
    includeUnknown: Type.Optional(Type.Boolean()),
    /**
     * Read first 8KB of each session transcript to derive title from first user message.
     * Performs a file read per session - use `limit` to bound result set on large stores.
     */
    includeDerivedTitles: Type.Optional(Type.Boolean()),
    /**
     * Read last 16KB of each session transcript to extract most recent message preview.
     * Performs a file read per session - use `limit` to bound result set on large stores.
     */
    includeLastMessage: Type.Optional(Type.Boolean()),
    label: Type.Optional(SessionLabelString),
    spawnedBy: Type.Optional(NonEmptyString),
    agentId: Type.Optional(NonEmptyString),
    search: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export const SessionsPreviewParamsSchema = Type.Object(
  {
    keys: Type.Array(NonEmptyString, { minItems: 1 }),
    limit: Type.Optional(Type.Integer({ minimum: 1 })),
    maxChars: Type.Optional(Type.Integer({ minimum: 20 })),
  },
  { additionalProperties: false },
);

export const SessionsResolveParamsSchema = Type.Object(
  {
    key: Type.Optional(NonEmptyString),
    sessionId: Type.Optional(NonEmptyString),
    label: Type.Optional(SessionLabelString),
    agentId: Type.Optional(NonEmptyString),
    spawnedBy: Type.Optional(NonEmptyString),
    includeGlobal: Type.Optional(Type.Boolean()),
    includeUnknown: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);

export const SessionsCreateParamsSchema = Type.Object(
  {
    key: Type.Optional(NonEmptyString),
    agentId: Type.Optional(NonEmptyString),
    label: Type.Optional(SessionLabelString),
    model: Type.Optional(NonEmptyString),
    parentSessionKey: Type.Optional(NonEmptyString),
    task: Type.Optional(Type.String()),
    message: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export const SessionsSendParamsSchema = Type.Object(
  {
    key: NonEmptyString,
    message: Type.String(),
    thinking: Type.Optional(Type.String()),
    attachments: Type.Optional(Type.Array(Type.Unknown())),
    timeoutMs: Type.Optional(Type.Integer({ minimum: 0 })),
    idempotencyKey: Type.Optional(NonEmptyString),
  },
  { additionalProperties: false },
);

export const SessionsMessagesSubscribeParamsSchema = Type.Object(
  {
    key: NonEmptyString,
  },
  { additionalProperties: false },
);

export const SessionsMessagesUnsubscribeParamsSchema = Type.Object(
  {
    key: NonEmptyString,
  },
  { additionalProperties: false },
);

export const SessionsAbortParamsSchema = Type.Object(
  {
    key: NonEmptyString,
    runId: Type.Optional(NonEmptyString),
  },
  { additionalProperties: false },
);

export const SessionsPatchParamsSchema = Type.Object(
  {
    key: NonEmptyString,
    label: Type.Optional(Type.Union([SessionLabelString, Type.Null()])),
    thinkingLevel: Type.Optional(Type.Union([NonEmptyString, Type.Null()])),
    fastMode: Type.Optional(Type.Union([Type.Boolean(), Type.Null()])),
    verboseLevel: Type.Optional(Type.Union([NonEmptyString, Type.Null()])),
    traceLevel: Type.Optional(Type.Union([NonEmptyString, Type.Null()])),
    reasoningLevel: Type.Optional(Type.Union([NonEmptyString, Type.Null()])),
    responseUsage: Type.Optional(
      Type.Union([
        Type.Literal("off"),
        Type.Literal("tokens"),
        Type.Literal("full"),
        // Backward compat with older clients/stores.
        Type.Literal("on"),
        Type.Null(),
      ]),
    ),
    elevatedLevel: Type.Optional(Type.Union([NonEmptyString, Type.Null()])),
    execHost: Type.Optional(Type.Union([NonEmptyString, Type.Null()])),
    execSecurity: Type.Optional(Type.Union([NonEmptyString, Type.Null()])),
    execAsk: Type.Optional(Type.Union([NonEmptyString, Type.Null()])),
    execNode: Type.Optional(Type.Union([NonEmptyString, Type.Null()])),
    model: Type.Optional(Type.Union([NonEmptyString, Type.Null()])),
    spawnedBy: Type.Optional(Type.Union([NonEmptyString, Type.Null()])),
    spawnedWorkspaceDir: Type.Optional(Type.Union([NonEmptyString, Type.Null()])),
    spawnDepth: Type.Optional(Type.Union([Type.Integer({ minimum: 0 }), Type.Null()])),
    subagentRole: Type.Optional(
      Type.Union([Type.Literal("orchestrator"), Type.Literal("leaf"), Type.Null()]),
    ),
    subagentControlScope: Type.Optional(
      Type.Union([Type.Literal("children"), Type.Literal("none"), Type.Null()]),
    ),
    sendPolicy: Type.Optional(
      Type.Union([Type.Literal("allow"), Type.Literal("deny"), Type.Null()]),
    ),
    groupActivation: Type.Optional(
      Type.Union([Type.Literal("mention"), Type.Literal("always"), Type.Null()]),
    ),
  },
  { additionalProperties: false },
);

export const SessionsResetParamsSchema = Type.Object(
  {
    key: NonEmptyString,
    reason: Type.Optional(Type.Union([Type.Literal("new"), Type.Literal("reset")])),
  },
  { additionalProperties: false },
);

export const SessionsClearParamsSchema = Type.Object(
  {
    key: NonEmptyString,
  },
  { additionalProperties: false },
);

export const SessionsDeleteParamsSchema = Type.Object(
  {
    key: NonEmptyString,
    deleteTranscript: Type.Optional(Type.Boolean()),
    // Internal control: when false, still unbind thread bindings but skip hook emission.
    emitLifecycleHooks: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);

export const SessionsCompactParamsSchema = Type.Object(
  {
    key: NonEmptyString,
    maxLines: Type.Optional(Type.Integer({ minimum: 1 })),
  },
  { additionalProperties: false },
);

export const SessionsCompactionListParamsSchema = Type.Object(
  {
    key: NonEmptyString,
  },
  { additionalProperties: false },
);

export const SessionsCompactionGetParamsSchema = Type.Object(
  {
    key: NonEmptyString,
    checkpointId: NonEmptyString,
  },
  { additionalProperties: false },
);

export const SessionsCompactionBranchParamsSchema = Type.Object(
  {
    key: NonEmptyString,
    checkpointId: NonEmptyString,
  },
  { additionalProperties: false },
);

export const SessionsCompactionRestoreParamsSchema = Type.Object(
  {
    key: NonEmptyString,
    checkpointId: NonEmptyString,
  },
  { additionalProperties: false },
);

export const SessionsCompactionListResultSchema = Type.Object(
  {
    ok: Type.Literal(true),
    key: NonEmptyString,
    checkpoints: Type.Array(SessionCompactionCheckpointSchema),
  },
  { additionalProperties: false },
);

export const SessionsCompactionGetResultSchema = Type.Object(
  {
    ok: Type.Literal(true),
    key: NonEmptyString,
    checkpoint: SessionCompactionCheckpointSchema,
  },
  { additionalProperties: false },
);

export const SessionsCompactionBranchResultSchema = Type.Object(
  {
    ok: Type.Literal(true),
    sourceKey: NonEmptyString,
    key: NonEmptyString,
    sessionId: NonEmptyString,
    checkpoint: SessionCompactionCheckpointSchema,
    entry: Type.Object(
      {
        sessionId: NonEmptyString,
        updatedAt: Type.Integer({ minimum: 0 }),
      },
      { additionalProperties: true },
    ),
  },
  { additionalProperties: false },
);

export const SessionsCompactionRestoreResultSchema = Type.Object(
  {
    ok: Type.Literal(true),
    key: NonEmptyString,
    sessionId: NonEmptyString,
    checkpoint: SessionCompactionCheckpointSchema,
    entry: Type.Object(
      {
        sessionId: NonEmptyString,
        updatedAt: Type.Integer({ minimum: 0 }),
      },
      { additionalProperties: true },
    ),
  },
  { additionalProperties: false },
);

export const SessionsUsageParamsSchema = Type.Object(
  {
    /** Specific session key to analyze; if omitted returns all sessions. */
    key: Type.Optional(NonEmptyString),
    /** Start date for range filter (YYYY-MM-DD). */
    startDate: Type.Optional(Type.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" })),
    /** End date for range filter (YYYY-MM-DD). */
    endDate: Type.Optional(Type.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" })),
    /** How start/end dates should be interpreted. Defaults to UTC when omitted. */
    mode: Type.Optional(
      Type.Union([Type.Literal("utc"), Type.Literal("gateway"), Type.Literal("specific")]),
    ),
    /** UTC offset to use when mode is `specific` (for example, UTC-4 or UTC+5:30). */
    utcOffset: Type.Optional(Type.String({ pattern: "^UTC[+-]\\d{1,2}(?::[0-5]\\d)?$" })),
    /** Maximum sessions to return (default 50). */
    limit: Type.Optional(Type.Integer({ minimum: 1 })),
    /** Include context weight breakdown (systemPromptReport). */
    includeContextWeight: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);

export const SessionsUsageEntrySchema = Type.Object(
  {
    key: NonEmptyString,
    label: Type.Optional(Type.String()),
    sessionId: Type.Optional(Type.String()),
    updatedAt: Type.Optional(Type.Number()),
    agentId: Type.Optional(Type.String()),
    channel: Type.Optional(Type.String()),
    chatType: Type.Optional(Type.String()),
    origin: Type.Optional(Type.Unknown()),
    modelOverride: Type.Optional(Type.String()),
    providerOverride: Type.Optional(Type.String()),
    modelProvider: Type.Optional(Type.String()),
    model: Type.Optional(Type.String()),
    usage: Type.Union([Type.Null(), Type.Unknown()]),
    contextWeight: Type.Optional(Type.Union([Type.Null(), Type.Unknown()])),
  },
  { additionalProperties: false },
);

export const SessionsUsageResultSchema = Type.Object(
  {
    updatedAt: Type.Number(),
    startDate: Type.String(),
    endDate: Type.String(),
    sessions: Type.Array(SessionsUsageEntrySchema),
    totals: Type.Unknown(),
    aggregates: Type.Unknown(),
  },
  { additionalProperties: false },
);

export const SessionsUsageTimeseriesResultSchema = Type.Unknown();

export const SessionsUsageLogsResultSchema = Type.Object(
  {
    logs: Type.Array(Type.Unknown()),
  },
  { additionalProperties: false },
);

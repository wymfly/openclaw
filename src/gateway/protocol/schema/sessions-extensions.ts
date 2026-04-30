import { Type } from "@sinclair/typebox";
import { NonEmptyString } from "./primitives.js";

const ThreadIdSchema = Type.Union([Type.String(), Type.Number()]);

export const DeliveryContextSchema = Type.Object(
  {
    channel: Type.Optional(Type.String()),
    to: Type.Optional(Type.String()),
    accountId: Type.Optional(Type.String()),
    threadId: Type.Optional(ThreadIdSchema),
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

export const SessionsClearParamsSchema = Type.Object(
  {
    key: NonEmptyString,
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

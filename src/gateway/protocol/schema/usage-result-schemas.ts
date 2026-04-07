import { Type } from "@sinclair/typebox";
import { NonEmptyString } from "./primitives.js";

const ThreadIdSchema = Type.Union([Type.String(), Type.Number()]);

const CostUsageTotalsProperties = {
  input: Type.Number(),
  output: Type.Number(),
  cacheRead: Type.Number(),
  cacheWrite: Type.Number(),
  totalTokens: Type.Number(),
  totalCost: Type.Number(),
  inputCost: Type.Number(),
  outputCost: Type.Number(),
  cacheReadCost: Type.Number(),
  cacheWriteCost: Type.Number(),
  missingCostEntries: Type.Number(),
};

export const CostUsageTotalsSchema = Type.Object(CostUsageTotalsProperties, {
  additionalProperties: false,
});

export const SessionDailyUsageSchema = Type.Object(
  {
    date: Type.String(),
    tokens: Type.Number(),
    cost: Type.Number(),
  },
  { additionalProperties: false },
);

export const SessionDailyMessageCountsSchema = Type.Object(
  {
    date: Type.String(),
    total: Type.Number(),
    user: Type.Number(),
    assistant: Type.Number(),
    toolCalls: Type.Number(),
    toolResults: Type.Number(),
    errors: Type.Number(),
  },
  { additionalProperties: false },
);

const SessionLatencyStatsProperties = {
  count: Type.Number(),
  avgMs: Type.Number(),
  p95Ms: Type.Number(),
  minMs: Type.Number(),
  maxMs: Type.Number(),
};

export const SessionLatencyStatsSchema = Type.Object(SessionLatencyStatsProperties, {
  additionalProperties: false,
});

export const SessionDailyLatencySchema = Type.Object(
  {
    date: Type.String(),
    ...SessionLatencyStatsProperties,
  },
  { additionalProperties: false },
);

export const SessionDailyModelUsageSchema = Type.Object(
  {
    date: Type.String(),
    provider: Type.Optional(Type.String()),
    model: Type.Optional(Type.String()),
    tokens: Type.Number(),
    cost: Type.Number(),
    count: Type.Number(),
  },
  { additionalProperties: false },
);

export const SessionMessageCountsSchema = Type.Object(
  {
    total: Type.Number(),
    user: Type.Number(),
    assistant: Type.Number(),
    toolCalls: Type.Number(),
    toolResults: Type.Number(),
    errors: Type.Number(),
  },
  { additionalProperties: false },
);

const SessionToolUsageItemSchema = Type.Object(
  {
    name: Type.String(),
    count: Type.Number(),
  },
  { additionalProperties: false },
);

export const SessionToolUsageSchema = Type.Object(
  {
    totalCalls: Type.Number(),
    uniqueTools: Type.Number(),
    tools: Type.Array(SessionToolUsageItemSchema),
  },
  { additionalProperties: false },
);

export const SessionModelUsageSchema = Type.Object(
  {
    provider: Type.Optional(Type.String()),
    model: Type.Optional(Type.String()),
    count: Type.Number(),
    totals: CostUsageTotalsSchema,
  },
  { additionalProperties: false },
);

export const SessionUsageOriginSchema = Type.Object(
  {
    label: Type.Optional(Type.String()),
    provider: Type.Optional(Type.String()),
    surface: Type.Optional(Type.String()),
    chatType: Type.Optional(Type.String()),
    from: Type.Optional(Type.String()),
    to: Type.Optional(Type.String()),
    accountId: Type.Optional(Type.String()),
    threadId: Type.Optional(ThreadIdSchema),
  },
  { additionalProperties: true },
);

const SessionSystemPromptBootstrapTruncationSchema = Type.Object(
  {
    warningMode: Type.Optional(
      Type.Union([Type.Literal("off"), Type.Literal("once"), Type.Literal("always")]),
    ),
    warningShown: Type.Optional(Type.Boolean()),
    promptWarningSignature: Type.Optional(Type.String()),
    warningSignaturesSeen: Type.Optional(Type.Array(Type.String())),
    truncatedFiles: Type.Optional(Type.Number()),
    nearLimitFiles: Type.Optional(Type.Number()),
    totalNearLimit: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: true },
);

const SessionSystemPromptSandboxSchema = Type.Object(
  {
    mode: Type.Optional(Type.String()),
    sandboxed: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: true },
);

const SessionSystemPromptUsageSchema = Type.Object(
  {
    chars: Type.Number(),
    projectContextChars: Type.Number(),
    nonProjectContextChars: Type.Number(),
  },
  { additionalProperties: false },
);

const SessionSystemPromptInjectedFileSchema = Type.Object(
  {
    name: Type.String(),
    path: Type.String(),
    missing: Type.Boolean(),
    rawChars: Type.Number(),
    injectedChars: Type.Number(),
    truncated: Type.Boolean(),
  },
  { additionalProperties: false },
);

const SessionSystemPromptSkillEntrySchema = Type.Object(
  {
    name: Type.String(),
    blockChars: Type.Number(),
  },
  { additionalProperties: false },
);

const SessionSystemPromptSkillsSchema = Type.Object(
  {
    promptChars: Type.Number(),
    entries: Type.Array(SessionSystemPromptSkillEntrySchema),
  },
  { additionalProperties: false },
);

const SessionSystemPromptToolEntrySchema = Type.Object(
  {
    name: Type.String(),
    summaryChars: Type.Number(),
    schemaChars: Type.Number(),
    propertiesCount: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
  },
  { additionalProperties: false },
);

const SessionSystemPromptToolsSchema = Type.Object(
  {
    listChars: Type.Number(),
    schemaChars: Type.Number(),
    entries: Type.Array(SessionSystemPromptToolEntrySchema),
  },
  { additionalProperties: false },
);

export const SessionSystemPromptReportSchema = Type.Object(
  {
    source: Type.Union([Type.Literal("run"), Type.Literal("estimate")]),
    generatedAt: Type.Number(),
    sessionId: Type.Optional(Type.String()),
    sessionKey: Type.Optional(Type.String()),
    provider: Type.Optional(Type.String()),
    model: Type.Optional(Type.String()),
    workspaceDir: Type.Optional(Type.String()),
    bootstrapMaxChars: Type.Optional(Type.Number()),
    bootstrapTotalMaxChars: Type.Optional(Type.Number()),
    bootstrapTruncation: Type.Optional(SessionSystemPromptBootstrapTruncationSchema),
    sandbox: Type.Optional(SessionSystemPromptSandboxSchema),
    systemPrompt: SessionSystemPromptUsageSchema,
    injectedWorkspaceFiles: Type.Array(SessionSystemPromptInjectedFileSchema),
    skills: SessionSystemPromptSkillsSchema,
    tools: SessionSystemPromptToolsSchema,
  },
  { additionalProperties: true },
);

export const SessionCostSummarySchema = Type.Object(
  {
    ...CostUsageTotalsProperties,
    sessionId: Type.Optional(Type.String()),
    sessionFile: Type.Optional(Type.String()),
    firstActivity: Type.Optional(Type.Number()),
    lastActivity: Type.Optional(Type.Number()),
    durationMs: Type.Optional(Type.Number()),
    activityDates: Type.Optional(Type.Array(Type.String())),
    dailyBreakdown: Type.Optional(Type.Array(SessionDailyUsageSchema)),
    dailyMessageCounts: Type.Optional(Type.Array(SessionDailyMessageCountsSchema)),
    dailyLatency: Type.Optional(Type.Array(SessionDailyLatencySchema)),
    dailyModelUsage: Type.Optional(Type.Array(SessionDailyModelUsageSchema)),
    messageCounts: Type.Optional(SessionMessageCountsSchema),
    toolUsage: Type.Optional(SessionToolUsageSchema),
    modelUsage: Type.Optional(Type.Array(SessionModelUsageSchema)),
    latency: Type.Optional(SessionLatencyStatsSchema),
  },
  { additionalProperties: true },
);

export const SessionUsageEntrySchema = Type.Object(
  {
    key: NonEmptyString,
    label: Type.Optional(Type.String()),
    sessionId: Type.Optional(Type.String()),
    updatedAt: Type.Optional(Type.Number()),
    agentId: Type.Optional(Type.String()),
    channel: Type.Optional(Type.String()),
    chatType: Type.Optional(Type.String()),
    origin: Type.Optional(SessionUsageOriginSchema),
    modelOverride: Type.Optional(Type.String()),
    providerOverride: Type.Optional(Type.String()),
    modelProvider: Type.Optional(Type.String()),
    model: Type.Optional(Type.String()),
    usage: Type.Union([SessionCostSummarySchema, Type.Null()]),
    contextWeight: Type.Optional(Type.Union([SessionSystemPromptReportSchema, Type.Null()])),
  },
  { additionalProperties: true },
);

const SessionsUsageByAgentSchema = Type.Object(
  {
    agentId: Type.String(),
    totals: CostUsageTotalsSchema,
  },
  { additionalProperties: false },
);

const SessionsUsageByChannelSchema = Type.Object(
  {
    channel: Type.String(),
    totals: CostUsageTotalsSchema,
  },
  { additionalProperties: false },
);

const SessionsUsageDailyAggregateSchema = Type.Object(
  {
    date: Type.String(),
    tokens: Type.Number(),
    cost: Type.Number(),
    messages: Type.Number(),
    toolCalls: Type.Number(),
    errors: Type.Number(),
  },
  { additionalProperties: false },
);

export const SessionsUsageAggregatesSchema = Type.Object(
  {
    messages: SessionMessageCountsSchema,
    tools: SessionToolUsageSchema,
    byModel: Type.Array(SessionModelUsageSchema),
    byProvider: Type.Array(SessionModelUsageSchema),
    byAgent: Type.Array(SessionsUsageByAgentSchema),
    byChannel: Type.Array(SessionsUsageByChannelSchema),
    latency: Type.Optional(SessionLatencyStatsSchema),
    dailyLatency: Type.Optional(Type.Array(SessionDailyLatencySchema)),
    modelDaily: Type.Optional(Type.Array(SessionDailyModelUsageSchema)),
    daily: Type.Array(SessionsUsageDailyAggregateSchema),
  },
  { additionalProperties: true },
);

export const SessionsUsageResultSchema = Type.Object(
  {
    updatedAt: Type.Number(),
    startDate: Type.String(),
    endDate: Type.String(),
    sessions: Type.Array(SessionUsageEntrySchema),
    totals: CostUsageTotalsSchema,
    aggregates: SessionsUsageAggregatesSchema,
  },
  { additionalProperties: false },
);

export const SessionLogEntrySchema = Type.Object(
  {
    timestamp: Type.Number(),
    role: Type.Union([
      Type.Literal("user"),
      Type.Literal("assistant"),
      Type.Literal("tool"),
      Type.Literal("toolResult"),
    ]),
    content: Type.String(),
    tokens: Type.Optional(Type.Number()),
    cost: Type.Optional(Type.Number()),
  },
  { additionalProperties: false },
);

export const SessionsUsageLogsParamsSchema = Type.Object(
  {
    key: NonEmptyString,
    limit: Type.Optional(Type.Number({ maximum: 1000, default: 200 })),
  },
  { additionalProperties: false },
);

export const SessionsUsageLogsResultSchema = Type.Object(
  {
    logs: Type.Array(SessionLogEntrySchema),
  },
  { additionalProperties: false },
);

export const SessionUsageTimePointSchema = Type.Object(
  {
    timestamp: Type.Number(),
    input: Type.Number(),
    output: Type.Number(),
    cacheRead: Type.Number(),
    cacheWrite: Type.Number(),
    totalTokens: Type.Number(),
    cost: Type.Number(),
    cumulativeTokens: Type.Number(),
    cumulativeCost: Type.Number(),
  },
  { additionalProperties: false },
);

export const SessionsUsageTimeseriesParamsSchema = Type.Object(
  {
    key: NonEmptyString,
  },
  { additionalProperties: false },
);

export const SessionsUsageTimeseriesResultSchema = Type.Object(
  {
    sessionId: Type.Optional(Type.String()),
    points: Type.Array(SessionUsageTimePointSchema),
  },
  { additionalProperties: false },
);

// ---------------------------------------------------------------------------
// usage.status — provider usage summary
// ---------------------------------------------------------------------------

const UsageWindowSchema = Type.Object(
  {
    label: Type.String(),
    usedPercent: Type.Number(),
    resetAt: Type.Optional(Type.Number()),
  },
  { additionalProperties: false },
);

const ProviderUsageSnapshotSchema = Type.Object(
  {
    provider: Type.String(),
    displayName: Type.String(),
    windows: Type.Array(UsageWindowSchema),
    plan: Type.Optional(Type.String()),
    error: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export const UsageStatusResultSchema = Type.Object(
  {
    updatedAt: Type.Number(),
    providers: Type.Array(ProviderUsageSnapshotSchema),
  },
  { additionalProperties: false },
);

// ---------------------------------------------------------------------------
// usage.cost — cost usage summary
// ---------------------------------------------------------------------------

const CostUsageDailyEntrySchema = Type.Object(
  {
    ...CostUsageTotalsProperties,
    date: Type.String(),
  },
  { additionalProperties: false },
);

export const UsageCostResultSchema = Type.Object(
  {
    updatedAt: Type.Number(),
    days: Type.Number(),
    daily: Type.Array(CostUsageDailyEntrySchema),
    totals: CostUsageTotalsSchema,
  },
  { additionalProperties: false },
);

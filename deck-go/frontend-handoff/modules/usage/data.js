// data.js — usage panel mock fixture
// Real DTOs: DeckGoUsageCostResponse / DeckGoUsageProvidersResponse /
// DeckGoUsageSessionsResponse / DeckGoUsageSessionLogsResponse /
// DeckGoUsageTimeseriesResponse / DeckGoContextWeightReport.

const NOW = Date.now();
const DAY = 86_400_000;

const PROVIDER_LABELS = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google AI",
  local: "Local (vllm)",
};

const MODEL_LABELS = {
  "claude-opus-4-7": "Opus 4.7",
  "claude-sonnet-4-6": "Sonnet 4.6",
  "claude-haiku-4-5-20251001": "Haiku 4.5",
  "gpt-5.5": "GPT-5.5",
  "gpt-5.4": "GPT-5.4",
  "gemini-2.5": "Gemini 2.5",
  "qwen3-32b": "Qwen3-32B",
};

const AGENT_LABELS = {
  main: "Daisy 🌼 (main)",
  "team-builder": "Team Builder",
  "ops-rotation": "Ops Rotation",
  "review-pool": "Review Pool",
  system: "System (housekeeping)",
};

const CHANNEL_LABELS = {
  telegram: "Telegram",
  discord: "Discord",
  slack: "Slack",
  wecom: "WeCom",
  email: "Email",
  cli: "CLI",
};

// Cost time-series (14 days), DeckGoUsageCostResponse
const COST_DAILY = [
  { date: "2026-04-21", totalCost: 12.84 },
  { date: "2026-04-22", totalCost: 14.01 },
  { date: "2026-04-23", totalCost: 17.55 },
  { date: "2026-04-24", totalCost: 19.04 },
  { date: "2026-04-25", totalCost: 22.91 },
  { date: "2026-04-26", totalCost: 8.76 },
  { date: "2026-04-27", totalCost: 7.42 },
  { date: "2026-04-28", totalCost: 16.2 },
  { date: "2026-04-29", totalCost: 23.55 },
  { date: "2026-04-30", totalCost: 28.12 },
  { date: "2026-05-01", totalCost: 31.04 },
  { date: "2026-05-02", totalCost: 34.78 },
  { date: "2026-05-03", totalCost: 29.66 },
  { date: "2026-05-04", totalCost: 24.18 },
];

const COST_RESPONSE = {
  updatedAt: NOW - 90_000,
  days: 14,
  daily: COST_DAILY,
};

// Provider quota windows, DeckGoUsageProvidersResponse
const PROVIDERS_RESPONSE = {
  updatedAt: NOW - 120_000,
  providers: [
    {
      provider: "anthropic",
      displayName: "Anthropic",
      plan: "Team (annual)",
      windows: [
        { label: "5h Sonnet", usedPercent: 92, resetAt: NOW + 1_800_000 },
        { label: "5h Opus", usedPercent: 41, resetAt: NOW + 1_800_000 },
        { label: "Weekly Sonnet", usedPercent: 67, resetAt: NOW + 4 * DAY },
        { label: "Weekly Opus", usedPercent: 28, resetAt: NOW + 4 * DAY },
      ],
    },
    {
      provider: "openai",
      displayName: "OpenAI",
      plan: "Pay-as-you-go",
      windows: [
        { label: "5h GPT-5.5", usedPercent: 14, resetAt: NOW + 2_400_000 },
        { label: "Daily GPT-5.5", usedPercent: 38, resetAt: NOW + 14 * 3600_000 },
      ],
    },
    {
      provider: "google",
      displayName: "Google AI",
      plan: "Free tier",
      error: "quota.unknown — last sync failed at 14:02",
      windows: [{ label: "Daily Gemini 2.5", usedPercent: 0, resetAt: NOW + 18 * 3600_000 }],
    },
    {
      provider: "local",
      displayName: "Local (vllm)",
      plan: "self-hosted",
      windows: [{ label: "Concurrent slots", usedPercent: 56 }],
    },
  ],
};

// Sessions table, DeckGoUsageSessionsResponse
const SESSIONS_RESPONSE = {
  updatedAt: NOW - 60_000,
  startDate: "2026-04-28",
  endDate: "2026-05-04",
  sessions: [
    {
      key: "ses_8f3c1a",
      label: "Daisy: refactor auth middleware",
      sessionId: "ses_8f3c1a",
      updatedAt: NOW - 4 * 60_000,
      agentId: "main",
      channel: "cli",
      usage: {
        input: 1_245_891,
        output: 812_440,
        totalTokens: 2_058_331,
        totalCost: 18.42,
      },
      contextWeight: {
        source: "run",
        generatedAt: NOW - 4 * 60_000,
        sessionId: "ses_8f3c1a",
        provider: "anthropic",
        model: "claude-opus-4-7",
        workspaceDir: "/Users/.../openclaw",
        systemPrompt: { chars: 18_412, projectContextChars: 7_380, nonProjectContextChars: 11_032 },
        injectedWorkspaceFiles: [
          {
            name: "AGENTS.md",
            path: "AGENTS.md",
            missing: false,
            rawChars: 8_240,
            injectedChars: 8_240,
            truncated: false,
          },
          {
            name: "deck-go/AGENTS.md",
            path: "deck-go/AGENTS.md",
            missing: false,
            rawChars: 12_440,
            injectedChars: 12_000,
            truncated: true,
          },
        ],
        skills: {
          promptChars: 4_201,
          entries: [
            { name: "openspec-apply-change", blockChars: 2_140 },
            { name: "ralph", blockChars: 2_061 },
          ],
        },
        tools: {
          listChars: 3_840,
          schemaChars: 18_290,
          entries: [
            { name: "Read", summaryChars: 220, schemaChars: 1_240, propertiesCount: 4 },
            { name: "Edit", summaryChars: 280, schemaChars: 1_580, propertiesCount: 4 },
            { name: "Bash", summaryChars: 1_600, schemaChars: 4_180, propertiesCount: 5 },
            { name: "Agent", summaryChars: 1_400, schemaChars: 11_290, propertiesCount: 7 },
          ],
        },
      },
    },
    {
      key: "ses_c4e91b",
      label: "Team Builder: deploy hotfix",
      sessionId: "ses_c4e91b",
      updatedAt: NOW - 22 * 60_000,
      agentId: "team-builder",
      channel: "slack",
      usage: { input: 412_104, output: 184_009, totalTokens: 596_113, totalCost: 4.18 },
      contextWeight: null,
    },
    {
      key: "ses_91aa07",
      label: "Ops Rotation: alert triage",
      sessionId: "ses_91aa07",
      updatedAt: NOW - 60 * 60_000,
      agentId: "ops-rotation",
      channel: "telegram",
      usage: { input: 88_240, output: 41_080, totalTokens: 129_320, totalCost: 0.61 },
      contextWeight: null,
    },
    {
      key: "ses_53ff22",
      label: "Daisy: review pool batch",
      sessionId: "ses_53ff22",
      updatedAt: NOW - 3 * 3600_000,
      agentId: "review-pool",
      channel: "cli",
      usage: { input: 218_000, output: 102_400, totalTokens: 320_400, totalCost: 1.84 },
      contextWeight: null,
    },
    {
      key: "ses_44dd11",
      label: "main: spec writing",
      sessionId: "ses_44dd11",
      updatedAt: NOW - 8 * 3600_000,
      agentId: "main",
      channel: "discord",
      usage: { input: 612_400, output: 308_104, totalTokens: 920_504, totalCost: 6.42 },
      contextWeight: null,
    },
    {
      key: "ses_2bb809",
      label: "system: housekeeping",
      sessionId: "ses_2bb809",
      updatedAt: NOW - 12 * 3600_000,
      agentId: "system",
      channel: "cli",
      usage: { input: 4_120, output: 980, totalTokens: 5_100, totalCost: 0.02 },
      contextWeight: null,
    },
    {
      key: "ses_7cc502",
      label: "Daisy: bugfix subagents",
      sessionId: "ses_7cc502",
      updatedAt: NOW - 18 * 3600_000,
      agentId: "main",
      channel: "wecom",
      usage: { input: 188_410, output: 96_300, totalTokens: 284_710, totalCost: 1.42 },
      contextWeight: null,
    },
    {
      key: "ses_18ee3a",
      label: "Team Builder: smoke test",
      sessionId: "ses_18ee3a",
      updatedAt: NOW - 26 * 3600_000,
      agentId: "team-builder",
      channel: "email",
      usage: null,
      contextWeight: null,
    },
  ],
  totals: {
    input: 2_769_165,
    output: 1_545_313,
    cacheRead: 412_004,
    cacheWrite: 88_312,
    totalTokens: 4_814_794,
    totalCost: 32.91,
  },
  aggregates: {
    byAgent: [
      {
        agentId: "main",
        totals: { input: 2_046_701, output: 1_222_244, totalTokens: 3_268_945, totalCost: 28.1 },
      },
      {
        agentId: "team-builder",
        totals: { input: 412_104, output: 184_009, totalTokens: 596_113, totalCost: 4.18 },
      },
      {
        agentId: "review-pool",
        totals: { input: 218_000, output: 102_400, totalTokens: 320_400, totalCost: 1.84 },
      },
      {
        agentId: "ops-rotation",
        totals: { input: 88_240, output: 41_080, totalTokens: 129_320, totalCost: 0.61 },
      },
      {
        agentId: "system",
        totals: { input: 4_120, output: 980, totalTokens: 5_100, totalCost: 0.02 },
      },
    ],
    byChannel: [
      {
        channel: "cli",
        totals: { input: 1_467_891, output: 915_820, totalTokens: 2_383_711, totalCost: 20.28 },
      },
      {
        channel: "slack",
        totals: { input: 412_104, output: 184_009, totalTokens: 596_113, totalCost: 4.18 },
      },
      {
        channel: "discord",
        totals: { input: 612_400, output: 308_104, totalTokens: 920_504, totalCost: 6.42 },
      },
      {
        channel: "telegram",
        totals: { input: 88_240, output: 41_080, totalTokens: 129_320, totalCost: 0.61 },
      },
      {
        channel: "wecom",
        totals: { input: 188_410, output: 96_300, totalTokens: 284_710, totalCost: 1.42 },
      },
      { channel: "email", totals: { input: 0, output: 0, totalTokens: 0, totalCost: 0 } },
    ],
    byModel: [
      {
        model: "claude-opus-4-7",
        provider: "anthropic",
        totals: { input: 1_801_405, output: 1_088_440, totalTokens: 2_889_845, totalCost: 26.1 },
      },
      {
        model: "claude-sonnet-4-6",
        provider: "anthropic",
        totals: { input: 612_400, output: 308_104, totalTokens: 920_504, totalCost: 4.42 },
      },
      {
        model: "gpt-5.5",
        provider: "openai",
        totals: { input: 218_000, output: 102_400, totalTokens: 320_400, totalCost: 1.84 },
      },
      {
        model: "claude-haiku-4-5-20251001",
        provider: "anthropic",
        totals: { input: 88_240, output: 41_080, totalTokens: 129_320, totalCost: 0.51 },
      },
      {
        model: "gemini-2.5",
        provider: "google",
        totals: { input: 49_120, output: 5_289, totalTokens: 54_409, totalCost: 0.04 },
      },
    ],
    byProvider: [
      {
        provider: "anthropic",
        totals: { input: 2_502_045, output: 1_437_624, totalTokens: 3_939_669, totalCost: 30.94 },
      },
      {
        provider: "openai",
        totals: { input: 218_000, output: 102_400, totalTokens: 320_400, totalCost: 1.84 },
      },
      {
        provider: "google",
        totals: { input: 49_120, output: 5_289, totalTokens: 54_409, totalCost: 0.04 },
      },
    ],
    daily: [
      { date: "2026-04-28", tokens: 612_410, cost: 4.42, messages: 184, toolCalls: 78, errors: 2 },
      { date: "2026-04-29", tokens: 921_004, cost: 7.18, messages: 256, toolCalls: 112, errors: 4 },
      {
        date: "2026-04-30",
        tokens: 1_104_220,
        cost: 9.04,
        messages: 311,
        toolCalls: 142,
        errors: 3,
      },
      {
        date: "2026-05-01",
        tokens: 1_215_804,
        cost: 10.42,
        messages: 348,
        toolCalls: 168,
        errors: 5,
      },
      {
        date: "2026-05-02",
        tokens: 1_344_120,
        cost: 11.61,
        messages: 392,
        toolCalls: 191,
        errors: 6,
      },
      {
        date: "2026-05-03",
        tokens: 1_188_322,
        cost: 9.78,
        messages: 326,
        toolCalls: 165,
        errors: 4,
      },
      { date: "2026-05-04", tokens: 982_010, cost: 8.04, messages: 274, toolCalls: 134, errors: 3 },
    ],
    latency: { count: 1840, avgMs: 612, p95Ms: 1_840, minMs: 88, maxMs: 4_200 },
    messages: {
      total: 2091,
      user: 814,
      assistant: 812,
      toolCalls: 990,
      toolResults: 988,
      errors: 23,
    },
    tools: {
      totalCalls: 990,
      uniqueTools: 14,
      tools: [
        { name: "Read", count: 312 },
        { name: "Edit", count: 218 },
        { name: "Bash", count: 184 },
        { name: "Agent", count: 96 },
        { name: "Grep", count: 58 },
        { name: "Glob", count: 46 },
        { name: "WebFetch", count: 38 },
        { name: "Write", count: 38 },
      ],
    },
    modelDaily: [
      {
        date: "2026-05-04",
        model: "claude-opus-4-7",
        provider: "anthropic",
        tokens: 612_410,
        cost: 5.84,
        count: 142,
      },
      {
        date: "2026-05-04",
        model: "claude-sonnet-4-6",
        provider: "anthropic",
        tokens: 218_000,
        cost: 1.42,
        count: 78,
      },
      {
        date: "2026-05-04",
        model: "gpt-5.5",
        provider: "openai",
        tokens: 88_240,
        cost: 0.61,
        count: 38,
      },
      {
        date: "2026-05-03",
        model: "claude-opus-4-7",
        provider: "anthropic",
        tokens: 802_410,
        cost: 7.18,
        count: 188,
      },
      {
        date: "2026-05-03",
        model: "claude-sonnet-4-6",
        provider: "anthropic",
        tokens: 312_004,
        cost: 2.04,
        count: 91,
      },
    ],
  },
};

// Per-session lazy logs, DeckGoUsageSessionLogsResponse
const SESSION_LOGS_BY_KEY = {
  ses_8f3c1a: {
    logs: [
      {
        timestamp: NOW - 32 * 60_000,
        role: "system",
        content: "Session start — model claude-opus-4-7 / workspace openclaw",
        tokens: 18_412,
        cost: 0,
      },
      { timestamp: NOW - 30 * 60_000, role: "user", content: "/ralph 继续", tokens: 6, cost: 0 },
      {
        timestamp: NOW - 29 * 60_000,
        role: "assistant",
        content: "Refactor auth middleware — splitting OAuth flow into separate handler.",
        tokens: 142,
        cost: 0.04,
      },
      {
        timestamp: NOW - 28 * 60_000,
        role: "tool_call",
        content: "Read src/auth/oauth.ts",
        tokens: 44,
        cost: 0.01,
      },
      {
        timestamp: NOW - 27 * 60_000,
        role: "tool_result",
        content: "(212 lines)",
        tokens: 2_140,
        cost: 0.18,
      },
      {
        timestamp: NOW - 25 * 60_000,
        role: "assistant",
        content: "Found 3 callers. Extracting handlerOAuthCallback...",
        tokens: 312,
        cost: 0.1,
      },
      {
        timestamp: NOW - 22 * 60_000,
        role: "tool_call",
        content: "Edit src/auth/oauth.ts — split callback handler",
        tokens: 88,
        cost: 0.02,
      },
      { timestamp: NOW - 18 * 60_000, role: "tool_result", content: "OK", tokens: 12, cost: 0 },
      {
        timestamp: NOW - 14 * 60_000,
        role: "assistant",
        content: "Tests: vitest src/auth — passing 14/14.",
        tokens: 64,
        cost: 0.02,
      },
    ],
  },
  ses_c4e91b: {
    logs: [
      {
        timestamp: NOW - 60 * 60_000,
        role: "user",
        content: "Deploy hotfix to canary 5%",
        tokens: 6,
        cost: 0,
      },
      {
        timestamp: NOW - 58 * 60_000,
        role: "assistant",
        content: "Running deploy/canary.yaml → 5% traffic.",
        tokens: 88,
        cost: 0.02,
      },
    ],
  },
};

// Per-session lazy timeseries, DeckGoUsageTimeseriesResponse
// 8 points spanning the session.
const SESSION_TIMESERIES_BY_KEY = {
  ses_8f3c1a: {
    sessionId: "ses_8f3c1a",
    points: [
      {
        timestamp: NOW - 32 * 60_000,
        input: 18_412,
        output: 0,
        cacheRead: 0,
        cacheWrite: 18_412,
        totalTokens: 18_412,
        cost: 0.04,
        cumulativeTokens: 18_412,
        cumulativeCost: 0.04,
      },
      {
        timestamp: NOW - 28 * 60_000,
        input: 84_120,
        output: 12_044,
        cacheRead: 12_400,
        cacheWrite: 4_120,
        totalTokens: 96_164,
        cost: 0.62,
        cumulativeTokens: 114_576,
        cumulativeCost: 0.66,
      },
      {
        timestamp: NOW - 24 * 60_000,
        input: 188_410,
        output: 41_002,
        cacheRead: 18_440,
        cacheWrite: 8_120,
        totalTokens: 229_412,
        cost: 1.84,
        cumulativeTokens: 343_988,
        cumulativeCost: 2.5,
      },
      {
        timestamp: NOW - 20 * 60_000,
        input: 312_044,
        output: 142_088,
        cacheRead: 24_410,
        cacheWrite: 12_004,
        totalTokens: 454_132,
        cost: 4.2,
        cumulativeTokens: 798_120,
        cumulativeCost: 6.7,
      },
      {
        timestamp: NOW - 16 * 60_000,
        input: 188_410,
        output: 188_044,
        cacheRead: 28_410,
        cacheWrite: 14_400,
        totalTokens: 376_454,
        cost: 4.18,
        cumulativeTokens: 1_174_574,
        cumulativeCost: 10.88,
      },
      {
        timestamp: NOW - 12 * 60_000,
        input: 142_044,
        output: 142_044,
        cacheRead: 18_410,
        cacheWrite: 12_440,
        totalTokens: 284_088,
        cost: 3.2,
        cumulativeTokens: 1_458_662,
        cumulativeCost: 14.08,
      },
      {
        timestamp: NOW - 8 * 60_000,
        input: 88_240,
        output: 102_044,
        cacheRead: 14_280,
        cacheWrite: 8_240,
        totalTokens: 190_284,
        cost: 2.42,
        cumulativeTokens: 1_648_946,
        cumulativeCost: 16.5,
      },
      {
        timestamp: NOW - 4 * 60_000,
        input: 36_402,
        output: 184_044,
        cacheRead: 8_240,
        cacheWrite: 4_120,
        totalTokens: 220_446,
        cost: 1.92,
        cumulativeTokens: 1_869_392,
        cumulativeCost: 18.42,
      },
    ],
  },
};

const RANGE_PRESETS = [
  { id: "24h", label: "Last 24h" },
  { id: "7d", label: "Last 7d" },
  { id: "14d", label: "Last 14d", isDefault: true },
  { id: "30d", label: "Last 30d" },
];

const BOOTSTRAP = { ok: true };

Object.assign(window, {
  USAGE_NOW: NOW,
  USAGE_PROVIDER_LABELS: PROVIDER_LABELS,
  USAGE_MODEL_LABELS: MODEL_LABELS,
  USAGE_AGENT_LABELS: AGENT_LABELS,
  USAGE_CHANNEL_LABELS: CHANNEL_LABELS,
  USAGE_COST_RESPONSE: COST_RESPONSE,
  USAGE_PROVIDERS_RESPONSE: PROVIDERS_RESPONSE,
  USAGE_SESSIONS_RESPONSE: SESSIONS_RESPONSE,
  USAGE_SESSION_LOGS_BY_KEY: SESSION_LOGS_BY_KEY,
  USAGE_SESSION_TIMESERIES_BY_KEY: SESSION_TIMESERIES_BY_KEY,
  USAGE_RANGE_PRESETS: RANGE_PRESETS,
  USAGE_BOOTSTRAP: BOOTSTRAP,
});

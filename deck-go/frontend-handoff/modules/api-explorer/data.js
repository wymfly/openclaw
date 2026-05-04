// API Explorer fixture — Gateway method catalog projection.
// Real source-of-truth: gateway describe RPC over WebSocket; this prototype
// uses an in-memory mirror with the same shape: namespace → method → schema +
// scope + handler hint. History entries simulate previous "Run" submissions.

const NOW = Date.now();
const MIN = 60_000;
const HR = 60 * MIN;

const iso = (msAgo) => new Date(NOW - msAgo).toISOString();

// -- Environments ---------------------------------------------------------

const ENVIRONMENTS = [
  { id: "local", label: "local · 127.0.0.1:8709", base: "ws://127.0.0.1:8709/gateway" },
  {
    id: "stage",
    label: "staging · stage.deck.openclaw.io",
    base: "wss://stage.deck.openclaw.io/gateway",
  },
  { id: "prod", label: "production · deck.openclaw.io", base: "wss://deck.openclaw.io/gateway" },
];

// -- Method catalog (the tree) -------------------------------------------

const METHOD_CATALOG = [
  {
    namespace: "deck.agents",
    description: "Agent registry and runtime control",
    methods: [
      {
        name: "deck.agents.list",
        kind: "query",
        scope: "operator.read",
        description: "List configured agents with current state.",
        params: { type: "object", properties: {}, required: [] },
        result: "DeckGoAgentsResponse",
        sample: {},
      },
      {
        name: "deck.agents.detail",
        kind: "query",
        scope: "operator.read",
        description: "Fetch agent identity, runtime stats, and recent sessions.",
        params: {
          type: "object",
          properties: {
            agentId: { type: "string", description: "Stable agent id (kebab-case)" },
            include: {
              type: "array",
              items: { type: "string" },
              description: "Optional sub-fields",
            },
          },
          required: ["agentId"],
        },
        result: "DeckGoAgentDetailResponse",
        sample: { agentId: "agent-fix-bug", include: ["sessions", "policy"] },
      },
      {
        name: "deck.agents.spawn",
        kind: "mutation",
        scope: "operator.write",
        description: "Start a new session for the named agent.",
        params: {
          type: "object",
          properties: {
            agentId: { type: "string" },
            input: { type: "string", description: "Initial user message" },
            channelId: { type: "string", nullable: true },
          },
          required: ["agentId", "input"],
        },
        result: "DeckGoSessionResponse",
        sample: {
          agentId: "agent-fix-bug",
          input: "Find the leak in the chat panel",
          channelId: null,
        },
      },
      {
        name: "deck.agents.kill",
        kind: "mutation",
        scope: "operator.admin",
        description: "Terminate a running agent session.",
        params: {
          type: "object",
          properties: {
            sessionId: { type: "string" },
            reason: { type: "string", nullable: true },
          },
          required: ["sessionId"],
        },
        result: "{ ok: true }",
        sample: { sessionId: "ses-7a3f-9b2e-...", reason: "operator request" },
      },
    ],
  },
  {
    namespace: "deck.approvals",
    description: "Pending approvals and policy editor",
    methods: [
      {
        name: "deck.approvals.list",
        kind: "query",
        scope: "operator.read",
        description: "List pending approvals.",
        params: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["pending", "approved", "rejected", "expired"] },
            limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
          },
          required: [],
        },
        result: "DeckGoApprovalsResponse",
        sample: { status: "pending", limit: 50 },
      },
      {
        name: "deck.approvals.resolve",
        kind: "mutation",
        scope: "operator.admin",
        description: "Approve or reject a pending request.",
        params: {
          type: "object",
          properties: {
            approvalId: { type: "string" },
            decision: { type: "string", enum: ["approve", "reject"] },
            note: { type: "string", nullable: true },
          },
          required: ["approvalId", "decision"],
        },
        result: "DeckGoApproval",
        sample: {
          approvalId: "appr-2026-04-29-1421",
          decision: "approve",
          note: "Signed off in #ops-deck",
        },
      },
    ],
  },
  {
    namespace: "deck.cron",
    description: "Scheduled jobs",
    methods: [
      {
        name: "deck.cron.list",
        kind: "query",
        scope: "operator.read",
        description: "List cron jobs.",
        params: { type: "object", properties: {}, required: [] },
        result: "DeckGoCronJobsResponse",
        sample: {},
      },
      {
        name: "deck.cron.trigger",
        kind: "mutation",
        scope: "operator.write",
        description: "Trigger a one-shot run for a cron job.",
        params: {
          type: "object",
          properties: {
            jobId: { type: "string" },
            overrideAt: { type: "string", format: "date-time", nullable: true },
          },
          required: ["jobId"],
        },
        result: "DeckGoCronRun",
        sample: { jobId: "cron-nightly-purge", overrideAt: null },
      },
    ],
  },
  {
    namespace: "deck.webhooks",
    description: "Outbound HTTP receivers",
    methods: [
      {
        name: "deck.webhooks.list",
        kind: "query",
        scope: "operator.read",
        description: "List configured webhooks.",
        params: { type: "object", properties: {}, required: [] },
        result: "DeckGoWebhooksResponse",
        sample: {},
      },
      {
        name: "deck.webhooks.test",
        kind: "mutation",
        scope: "operator.write",
        description: "Send a synthetic test delivery to the receiver.",
        params: {
          type: "object",
          properties: {
            webhookId: { type: "string" },
            eventType: { type: "string", nullable: true },
          },
          required: ["webhookId"],
        },
        result: "DeckGoWebhookDelivery",
        sample: { webhookId: "wh-ops-slack", eventType: "alert.fired" },
      },
    ],
  },
  {
    namespace: "deck.gateway",
    description: "Control-plane introspection",
    methods: [
      {
        name: "deck.gateway.describe",
        kind: "query",
        scope: "operator.read",
        description: "Return the full method registry (this catalog).",
        params: { type: "object", properties: {}, required: [] },
        result: "DeckGoGatewayDescribeResponse",
        sample: {},
      },
      {
        name: "deck.gateway.batch",
        kind: "mutation",
        scope: "operator.write",
        description: "Execute multiple methods atomically in a single transport round-trip.",
        params: {
          type: "object",
          properties: {
            requests: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  method: { type: "string" },
                  params: { type: "object" },
                },
                required: ["method", "params"],
              },
            },
            options: {
              type: "object",
              properties: {
                stopOnError: { type: "boolean", default: false },
              },
            },
          },
          required: ["requests"],
        },
        result: "DeckGoGatewayBatchResponse",
        sample: {
          requests: [
            { method: "deck.agents.list", params: {} },
            { method: "deck.cron.list", params: {} },
          ],
          options: { stopOnError: false },
        },
      },
    ],
  },
  {
    namespace: "deck.sessions",
    description: "Session timeline + transcript",
    methods: [
      {
        name: "deck.sessions.list",
        kind: "query",
        scope: "operator.read",
        description: "List recent sessions.",
        params: {
          type: "object",
          properties: {
            agentId: { type: "string", nullable: true },
            limit: { type: "integer", default: 100 },
          },
          required: [],
        },
        result: "DeckGoSessionsResponse",
        sample: { agentId: null, limit: 100 },
      },
      {
        name: "deck.sessions.transcript",
        kind: "query",
        scope: "operator.read",
        description: "Fetch the full message transcript for a session.",
        params: {
          type: "object",
          properties: {
            sessionId: { type: "string" },
            cursor: { type: "string", nullable: true },
          },
          required: ["sessionId"],
        },
        result: "DeckGoSessionTranscript",
        sample: { sessionId: "ses-7a3f-9b2e-...", cursor: null },
      },
    ],
  },
];

// -- History entries (last N runs) ----------------------------------------

const HISTORY = [
  {
    id: "hist-001",
    method: "deck.agents.detail",
    paramsPreview: { agentId: "agent-fix-bug" },
    statusCode: 200,
    durationMs: 142,
    success: true,
    at: iso(2 * MIN),
    env: "local",
  },
  {
    id: "hist-002",
    method: "deck.cron.trigger",
    paramsPreview: { jobId: "cron-nightly-purge" },
    statusCode: 202,
    durationMs: 318,
    success: true,
    at: iso(11 * MIN),
    env: "local",
  },
  {
    id: "hist-003",
    method: "deck.webhooks.test",
    paramsPreview: { webhookId: "wh-flaky-internal" },
    statusCode: 504,
    durationMs: 5021,
    success: false,
    error: "upstream timed out after 5s",
    at: iso(17 * MIN),
    env: "stage",
  },
  {
    id: "hist-004",
    method: "deck.gateway.batch",
    paramsPreview: { requests: 2 },
    statusCode: 200,
    durationMs: 87,
    success: true,
    at: iso(28 * MIN),
    env: "local",
  },
  {
    id: "hist-005",
    method: "deck.approvals.resolve",
    paramsPreview: { approvalId: "appr-2026-04-29-1421", decision: "approve" },
    statusCode: 200,
    durationMs: 96,
    success: true,
    at: iso(42 * MIN),
    env: "local",
  },
  {
    id: "hist-006",
    method: "deck.agents.kill",
    paramsPreview: { sessionId: "ses-stale-3a..." },
    statusCode: 403,
    durationMs: 24,
    success: false,
    error: "scope denied: requires operator.admin",
    at: iso(2 * HR),
    env: "prod",
  },
  {
    id: "hist-007",
    method: "deck.agents.list",
    paramsPreview: {},
    statusCode: 200,
    durationMs: 58,
    success: true,
    at: iso(3 * HR + 12 * MIN),
    env: "local",
  },
  {
    id: "hist-008",
    method: "deck.sessions.transcript",
    paramsPreview: { sessionId: "ses-2025-12-01-a1...", cursor: null },
    statusCode: 200,
    durationMs: 412,
    success: true,
    at: iso(5 * HR),
    env: "local",
  },
];

// -- Sample response payloads (for "Run" simulation) ---------------------

const SAMPLE_RESPONSES = {
  "deck.agents.list": {
    statusCode: 200,
    body: {
      agents: [
        { id: "agent-fix-bug", name: "Fix bug", enabled: true, runningSessions: 1 },
        { id: "agent-write-pr", name: "Write PR", enabled: true, runningSessions: 0 },
        { id: "agent-research", name: "Research", enabled: false, runningSessions: 0 },
      ],
      total: 3,
    },
    headers: {
      "content-type": "application/json",
      "x-deck-trace": "trace-7c2f9b...",
      "x-deck-duration-ms": "58",
    },
  },
  "deck.agents.detail": {
    statusCode: 200,
    body: {
      agent: {
        id: "agent-fix-bug",
        name: "Fix bug",
        description: "Investigates and fixes a single bug end-to-end.",
        enabled: true,
        policy: { autoApprove: false, maxRuntime: "30m", maxRetries: 2 },
        runtime: { sessionsLastHour: 4, avgDurationMs: 18742 },
        sessions: [
          { id: "ses-7a3f", startedAt: "2026-05-04T08:14:32Z", status: "running" },
          { id: "ses-9b2e", startedAt: "2026-05-04T07:51:08Z", status: "completed" },
        ],
      },
    },
    headers: {
      "content-type": "application/json",
      "x-deck-trace": "trace-3f8a2d...",
      "x-deck-duration-ms": "142",
    },
  },
  "deck.gateway.batch": {
    statusCode: 200,
    body: {
      results: [
        { method: "deck.agents.list", success: true, body: { agents: ["…3 entries…"], total: 3 } },
        { method: "deck.cron.list", success: true, body: { jobs: ["…9 entries…"], total: 9 } },
      ],
      durationMs: 87,
    },
    headers: { "content-type": "application/json", "x-deck-trace": "trace-batch-7c..." },
  },
  "deck.webhooks.test": {
    statusCode: 200,
    body: {
      delivery: {
        id: "dlv-test-7c2f",
        webhookId: "wh-ops-slack",
        eventType: "alert.fired",
        statusCode: 200,
        success: true,
        durationMs: 245,
        responseBody: '{"ok":true}',
      },
    },
    headers: { "content-type": "application/json", "x-deck-duration-ms": "263" },
  },
};

// Default mock response shape for unknown methods (success path)
const DEFAULT_SAMPLE_RESPONSE = {
  statusCode: 200,
  body: { ok: true, note: "stub response — see SAMPLE_RESPONSES in data.js for richer fixtures" },
  headers: { "content-type": "application/json" },
};

const BOOTSTRAP = { ok: true, runtimeVersion: "0.5.0", connectedTo: "local" };

Object.assign(window, {
  ENVIRONMENTS,
  METHOD_CATALOG,
  HISTORY,
  SAMPLE_RESPONSES,
  DEFAULT_SAMPLE_RESPONSE,
  BOOTSTRAP,
});

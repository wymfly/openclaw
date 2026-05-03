// data.js — Mock fixture for the deck-go config workbench prototype (v2).
//
// Models the deck-go contract:
//   GET  /api/config              → DeckGoConfigSnapshotResponse
//   POST /api/config/apply        → DeckGoConfigApplyResponse
//   POST /api/config/schema-lookup → DeckGoConfigLookupResponse (per path)
//
// The contract does NOT carry the full schema in one shot — schema is
// fetched per-path. The prototype models that by precomputing a synthetic
// schema map (`schemaLookups`) keyed by dotted path. Production must call
// the real schema-lookup endpoint and stream children as the user expands.

const baseHash = "config-hash-v2-001";

// Realistic openclaw.json shape — 6 top-level sections × ~30 leaf fields.
const config = {
  agents: {
    defaults: {
      model: "claude-opus-4-7",
      thinkingDefault: "medium",
      maxTokens: 16384,
      allowShell: true,
      autoApprove: false,
      systemPromptOverride: "",
    },
    main: {
      label: "main",
      tools: ["read", "edit", "bash", "grep"],
      memoryEnabled: true,
      hooksEnabled: true,
    },
    research: {
      label: "research",
      tools: ["read", "grep", "webfetch"],
      memoryEnabled: false,
      hooksEnabled: false,
    },
  },
  models: {
    defaultModel: "claude-opus-4-7",
    providers: {
      anthropic: {
        apiKey: "$ANTHROPIC_API_KEY",
        baseUrl: "https://api.anthropic.com",
        timeout: 120000,
      },
      openai: {
        apiKey: "$OPENAI_API_KEY",
        baseUrl: "https://api.openai.com",
        organizationId: "",
      },
      local: {
        baseUrl: "http://127.0.0.1:11434",
        models: ["llama-3-70b", "qwen-2.5-72b"],
      },
    },
  },
  channels: {
    discord: {
      enabled: true,
      token: "$DISCORD_BOT_TOKEN",
      defaultAgentId: "main",
      autoReplyMentions: true,
    },
    telegram: {
      enabled: false,
      token: "",
      defaultAgentId: "main",
      botUsername: "",
    },
    wecom: {
      enabled: true,
      corpId: "ww0123456789",
      agentId: "1000002",
      secret: "$WECOM_SECRET",
      defaultAgentId: "main",
    },
    slack: {
      enabled: false,
      botToken: "",
      appToken: "",
      defaultAgentId: "main",
    },
    qq: {
      enabled: false,
      botUin: "",
      defaultAgentId: "research",
    },
  },
  plugins: {
    autoload: ["wecom", "discord", "memory"],
    disabled: [],
    sources: ["bundled", "extensions"],
  },
  hooks: {
    PreToolUse: { enabled: true, command: "" },
    PostToolUse: { enabled: false, command: "" },
    SessionStart: { enabled: true, command: "" },
  },
  runtime: {
    bind: "127.0.0.1",
    port: 18789,
    logLevel: "info",
    metricsEnabled: true,
    sessionStoragePath: ".openclaw/sessions",
  },
};

// Schema lookups — the contract returns one of these per `path` request.
// `type`, `required`, `hasChildren`, and `hint` are first-class.
const schemaLookups = {
  "": {
    path: "",
    schema: { type: "object" },
    children: [
      {
        key: "agents",
        path: "agents",
        type: "object",
        required: false,
        hasChildren: true,
        hint: { description: "Agent runtime defaults + named overrides." },
      },
      {
        key: "models",
        path: "models",
        type: "object",
        required: false,
        hasChildren: true,
        hint: { description: "Model defaults + provider config." },
      },
      {
        key: "channels",
        path: "channels",
        type: "object",
        required: false,
        hasChildren: true,
        hint: { description: "Per-channel enablement + credentials." },
      },
      {
        key: "plugins",
        path: "plugins",
        type: "object",
        required: false,
        hasChildren: true,
        hint: { description: "Plugin autoload + disable rules." },
      },
      {
        key: "hooks",
        path: "hooks",
        type: "object",
        required: false,
        hasChildren: true,
        hint: { description: "Lifecycle hook commands." },
      },
      {
        key: "runtime",
        path: "runtime",
        type: "object",
        required: false,
        hasChildren: true,
        hint: { description: "Local Gateway runtime parameters." },
      },
    ],
  },
  agents: {
    path: "agents",
    schema: { type: "object" },
    children: [
      {
        key: "defaults",
        path: "agents.defaults",
        type: "object",
        required: true,
        hasChildren: true,
        hint: { description: "Default agent configuration applied when not overridden." },
      },
      {
        key: "main",
        path: "agents.main",
        type: "object",
        required: false,
        hasChildren: true,
        hint: { description: "Named agent override." },
      },
      {
        key: "research",
        path: "agents.research",
        type: "object",
        required: false,
        hasChildren: true,
        hint: { description: "Named agent override." },
      },
    ],
  },
  "agents.defaults": {
    path: "agents.defaults",
    schema: { type: "object" },
    children: [
      {
        key: "model",
        path: "agents.defaults.model",
        type: "string",
        required: true,
        hasChildren: false,
        hint: {
          description: "Default model id used by all agents.",
          enum: [
            "claude-opus-4-7",
            "claude-sonnet-4-6",
            "claude-haiku-4-5",
            "gpt-5",
            "qwen-2.5-72b",
          ],
        },
      },
      {
        key: "thinkingDefault",
        path: "agents.defaults.thinkingDefault",
        type: "string",
        required: false,
        hasChildren: false,
        hint: { description: "Default reasoning depth.", enum: ["low", "medium", "high"] },
      },
      {
        key: "maxTokens",
        path: "agents.defaults.maxTokens",
        type: "integer",
        required: false,
        hasChildren: false,
        hint: { description: "Max output tokens per response.", minimum: 1024, maximum: 64000 },
      },
      {
        key: "allowShell",
        path: "agents.defaults.allowShell",
        type: "boolean",
        required: false,
        hasChildren: false,
        hint: { description: "Allow Bash tool by default." },
      },
      {
        key: "autoApprove",
        path: "agents.defaults.autoApprove",
        type: "boolean",
        required: false,
        hasChildren: false,
        hint: { description: "Auto-approve write/edit operations (DANGEROUS)." },
      },
      {
        key: "systemPromptOverride",
        path: "agents.defaults.systemPromptOverride",
        type: "string",
        required: false,
        hasChildren: false,
        hint: { description: "Override system prompt; empty = use built-in." },
      },
    ],
  },
  models: {
    path: "models",
    schema: { type: "object" },
    children: [
      {
        key: "defaultModel",
        path: "models.defaultModel",
        type: "string",
        required: true,
        hasChildren: false,
        hint: {
          description: "Fallback model when agent doesn't specify.",
          enum: ["claude-opus-4-7", "claude-sonnet-4-6", "gpt-5"],
        },
      },
      {
        key: "providers",
        path: "models.providers",
        type: "object",
        required: false,
        hasChildren: true,
        hint: { description: "Per-provider auth + endpoint config." },
      },
    ],
  },
  "models.providers": {
    path: "models.providers",
    schema: { type: "object" },
    children: [
      {
        key: "anthropic",
        path: "models.providers.anthropic",
        type: "object",
        required: false,
        hasChildren: true,
        hint: {},
      },
      {
        key: "openai",
        path: "models.providers.openai",
        type: "object",
        required: false,
        hasChildren: true,
        hint: {},
      },
      {
        key: "local",
        path: "models.providers.local",
        type: "object",
        required: false,
        hasChildren: true,
        hint: {},
      },
    ],
  },
  "models.providers.anthropic": {
    path: "models.providers.anthropic",
    schema: { type: "object" },
    children: [
      {
        key: "apiKey",
        path: "models.providers.anthropic.apiKey",
        type: "string",
        required: false,
        hasChildren: false,
        hint: {
          description: "Anthropic API key. Use $ENV_VAR to read from environment.",
          secret: true,
        },
      },
      {
        key: "baseUrl",
        path: "models.providers.anthropic.baseUrl",
        type: "string",
        required: false,
        hasChildren: false,
        hint: { description: "Override default base URL.", format: "uri" },
      },
      {
        key: "timeout",
        path: "models.providers.anthropic.timeout",
        type: "integer",
        required: false,
        hasChildren: false,
        hint: { description: "Request timeout in ms." },
      },
    ],
  },
  channels: {
    path: "channels",
    schema: { type: "object" },
    children: [
      {
        key: "discord",
        path: "channels.discord",
        type: "object",
        required: false,
        hasChildren: true,
        hint: {},
      },
      {
        key: "telegram",
        path: "channels.telegram",
        type: "object",
        required: false,
        hasChildren: true,
        hint: {},
      },
      {
        key: "wecom",
        path: "channels.wecom",
        type: "object",
        required: false,
        hasChildren: true,
        hint: {},
      },
      {
        key: "slack",
        path: "channels.slack",
        type: "object",
        required: false,
        hasChildren: true,
        hint: {},
      },
      {
        key: "qq",
        path: "channels.qq",
        type: "object",
        required: false,
        hasChildren: true,
        hint: {},
      },
    ],
  },
  "channels.discord": {
    path: "channels.discord",
    schema: { type: "object" },
    children: [
      {
        key: "enabled",
        path: "channels.discord.enabled",
        type: "boolean",
        required: false,
        hasChildren: false,
        hint: { description: "Enable Discord channel." },
      },
      {
        key: "token",
        path: "channels.discord.token",
        type: "string",
        required: true,
        hasChildren: false,
        hint: { description: "Discord bot token. Use $ENV_VAR.", secret: true },
      },
      {
        key: "defaultAgentId",
        path: "channels.discord.defaultAgentId",
        type: "string",
        required: false,
        hasChildren: false,
        hint: { description: "Agent that handles Discord messages by default." },
      },
      {
        key: "autoReplyMentions",
        path: "channels.discord.autoReplyMentions",
        type: "boolean",
        required: false,
        hasChildren: false,
        hint: { description: "Auto-reply when bot is @mentioned." },
      },
    ],
  },
  plugins: {
    path: "plugins",
    schema: { type: "object" },
    children: [
      {
        key: "autoload",
        path: "plugins.autoload",
        type: "array",
        required: false,
        hasChildren: false,
        hint: { description: "Plugins loaded on startup." },
      },
      {
        key: "disabled",
        path: "plugins.disabled",
        type: "array",
        required: false,
        hasChildren: false,
        hint: { description: "Plugins explicitly disabled (override autoload)." },
      },
      {
        key: "sources",
        path: "plugins.sources",
        type: "array",
        required: false,
        hasChildren: false,
        hint: {
          description: "Search paths for plugin discovery.",
          enum: ["bundled", "extensions", "user"],
        },
      },
    ],
  },
  hooks: {
    path: "hooks",
    schema: { type: "object" },
    children: [
      {
        key: "PreToolUse",
        path: "hooks.PreToolUse",
        type: "object",
        required: false,
        hasChildren: true,
        hint: {},
      },
      {
        key: "PostToolUse",
        path: "hooks.PostToolUse",
        type: "object",
        required: false,
        hasChildren: true,
        hint: {},
      },
      {
        key: "SessionStart",
        path: "hooks.SessionStart",
        type: "object",
        required: false,
        hasChildren: true,
        hint: {},
      },
    ],
  },
  "hooks.PreToolUse": {
    path: "hooks.PreToolUse",
    schema: { type: "object" },
    children: [
      {
        key: "enabled",
        path: "hooks.PreToolUse.enabled",
        type: "boolean",
        required: false,
        hasChildren: false,
        hint: { description: "Enable this lifecycle hook." },
      },
      {
        key: "command",
        path: "hooks.PreToolUse.command",
        type: "string",
        required: false,
        hasChildren: false,
        hint: { description: "Shell command run before each tool use." },
      },
    ],
  },
  runtime: {
    path: "runtime",
    schema: { type: "object" },
    children: [
      {
        key: "bind",
        path: "runtime.bind",
        type: "string",
        required: false,
        hasChildren: false,
        hint: {
          description: "Gateway bind interface.",
          enum: ["127.0.0.1", "0.0.0.0", "loopback"],
        },
      },
      {
        key: "port",
        path: "runtime.port",
        type: "integer",
        required: false,
        hasChildren: false,
        hint: { description: "Gateway listen port.", minimum: 1024, maximum: 65535 },
      },
      {
        key: "logLevel",
        path: "runtime.logLevel",
        type: "string",
        required: false,
        hasChildren: false,
        hint: {
          description: "Default log level.",
          enum: ["trace", "debug", "info", "warn", "error"],
        },
      },
      {
        key: "metricsEnabled",
        path: "runtime.metricsEnabled",
        type: "boolean",
        required: false,
        hasChildren: false,
        hint: { description: "Expose Prometheus metrics on /metrics." },
      },
      {
        key: "sessionStoragePath",
        path: "runtime.sessionStoragePath",
        type: "string",
        required: false,
        hasChildren: false,
        hint: { description: "Local filesystem path for session journals." },
      },
    ],
  },
};

// Top-level section nav order — matches openclaw.json author intent.
const sections = [
  {
    id: "agents",
    label: "Agents",
    path: "agents",
    description: "Default agent runtime + named overrides",
    icon: "agent",
  },
  {
    id: "models",
    label: "Models",
    path: "models",
    description: "Provider auth + default model",
    icon: "model",
  },
  {
    id: "channels",
    label: "Channels",
    path: "channels",
    description: "Discord / Telegram / WeCom / Slack / QQ",
    icon: "channel",
  },
  {
    id: "plugins",
    label: "Plugins",
    path: "plugins",
    description: "Autoload + disable rules",
    icon: "plugin",
  },
  {
    id: "hooks",
    label: "Hooks",
    path: "hooks",
    description: "Lifecycle command hooks",
    icon: "hook",
  },
  {
    id: "runtime",
    label: "Runtime",
    path: "runtime",
    description: "Bind / port / metrics / log level",
    icon: "runtime",
  },
];

const initialSnapshot = {
  path: ".openclaw/openclaw.json",
  exists: true,
  valid: true,
  raw: JSON.stringify(config, null, 2),
  config: config,
  hash: baseHash,
  baseHash,
};

const recentApplies = [
  {
    ts: Date.now() - 1000 * 60 * 12,
    actor: "operator:owner@openclaw",
    paths: ["agents.defaults.model"],
    previousHash: "config-hash-v1-072",
    newHash: baseHash,
    ok: true,
  },
  {
    ts: Date.now() - 1000 * 60 * 60 * 3,
    actor: "operator:owner@openclaw",
    paths: ["channels.wecom.enabled", "channels.wecom.corpId"],
    previousHash: "config-hash-v1-068",
    newHash: "config-hash-v1-072",
    ok: true,
  },
  {
    ts: Date.now() - 1000 * 60 * 60 * 26,
    actor: "system",
    paths: ["runtime.metricsEnabled"],
    previousHash: "config-hash-v1-066",
    newHash: "config-hash-v1-068",
    ok: true,
  },
  {
    ts: Date.now() - 1000 * 60 * 60 * 50,
    actor: "operator:owner@openclaw",
    paths: ["models.providers.anthropic.apiKey"],
    previousHash: "config-hash-v1-064",
    newHash: "config-hash-v1-066",
    ok: false,
    error: "validation: apiKey must reference $ENV var",
  },
];

window.ConfigData = {
  initialSnapshot,
  schemaLookups,
  sections,
  recentApplies,
};

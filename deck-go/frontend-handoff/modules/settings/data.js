// data.js — Mock fixture for the deck-go settings prototype (v2).
//
// Models the deck-go contract:
//   GET  /api/settings                    → DeckGoSettingsResponse
//   POST /api/settings                    → DeckGoSettingsSaveResponse
//   POST /api/settings/test-connection    → DeckGoSettingsConnectionResponse
//   GET  /api/settings/version            → DeckGoSettingsVersionResponse
//   GET  /api/runtime/gateway             → DeckGoRuntimeGatewayResponse
//   GET  /api/runtime/endpoint            → DeckGoRuntimeEndpointResponse
//   PUT  /api/runtime/endpoint            → updates remote endpoint config
//   POST /api/runtime/endpoint/test       → DeckGoRuntimeEndpointTestResponse
//   GET  /api/bootstrap/status            → DeckGoBootstrapStatusResponse
//
// IMPORTANT runtime-mode semantics (per current refactor):
//   - bundled: deck-go spawns Gateway from .env config; UI is READ-ONLY for
//     runtime fields (URL/token/tlsVerify/command/autoStart). UI may not
//     mutate the bundled supervisor's address.
//   - remote: UI may edit URL/token/tlsVerify; writes to JSON config and
//     overrides .env defaults on next start.

const settings = {
  accessTokenConfigured: true,
  accessTokenSource: "env", // "env" | "json" | "missing"
  appearance: {
    theme: "dark",
    density: "compact",
    reducedMotion: false,
    fontSize: 14,
  },
  notifications: {
    desktop: true,
    sound: false,
    quietHoursEnabled: true,
    quietHoursStart: "22:00",
    quietHoursEnd: "08:00",
  },
  pairedDevices: [
    {
      id: "dev-mbpro-1",
      name: "MacBook Pro 16″",
      lastSeen: Date.now() - 1000 * 60 * 4,
      ip: "192.168.1.42",
      platform: "darwin",
      version: "deck-go 0.4.2",
    },
    {
      id: "dev-iphone-15",
      name: "iPhone 15 Pro",
      lastSeen: Date.now() - 1000 * 60 * 60 * 2,
      ip: "192.168.1.71",
      platform: "ios",
      version: "deck-go-mobile 0.3.1",
    },
    {
      id: "dev-windows-wsl",
      name: "WSL2 (Ubuntu 22.04)",
      lastSeen: Date.now() - 1000 * 60 * 60 * 26,
      ip: "10.8.114.34",
      platform: "linux",
      version: "deck-go 0.4.2",
    },
  ],
};

const version = {
  deck: "0.4.2",
  gateway: "0.7.1",
  cli: "0.4.0",
};

// Bundled-mode runtime status — supervised by deck-go process supervisor.
const bundledRuntime = {
  mode: "bundled",
  managed: true,
  configured: true,
  status: "running",
  health: "healthy",
  gatewayUrl: "http://127.0.0.1:18789",
  pid: 91842,
  startedAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
  autoStart: true,
  owner: "deck-go-supervisor",
  ownershipState: "owned",
  ownershipFile: "/var/run/openclaw/gateway.lock",
  restartAttempts: 0,
  latencyP50: 12,
  tlsVerified: false,
};

// Remote-mode runtime status — operator-edited endpoint pointing to a remote Gateway.
const remoteRuntime = {
  mode: "remote",
  managed: false,
  configured: true,
  status: "running",
  health: "healthy",
  gatewayUrl: "https://gateway.internal.openclaw.dev:8443",
  lastConnectedAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
  latencyP50: 28,
  tlsVerified: true,
};

const initialBootstrap = {
  ok: true,
  settings: {
    path: "~/.openclaw/deck-go-settings.json",
    accessTokenConfigured: true,
    managedGatewayConfigured: true,
    commandConfigured: true,
    gatewayTokenConfigured: true,
    autoStart: true,
  },
  runtime: bundledRuntime, // default to bundled — Tweaks toggle to remote
  gateway: {
    connected: true,
    capabilitySnapshotAvailable: true,
    methodCount: 132,
    eventCount: 18,
    schemaVersion: "deck-protocol-2026-04",
  },
};

const remoteEndpoint = {
  url: "https://gateway.internal.openclaw.dev:8443",
  tokenConfigured: true,
  tlsVerify: true,
  source: "json", // "env" | "json"
};

// 6 sections, each with a fixed shape. Schema-driven where it helps,
// curated where the contract surface is opaque (`Record<string, unknown>`).
const sections = [
  {
    id: "identity",
    label: "Identity & access",
    icon: "key",
    description: "Access token + token provenance",
  },
  { id: "runtime", label: "Runtime", icon: "runtime", description: "bundled / remote Gateway" },
  {
    id: "appearance",
    label: "Appearance",
    icon: "appearance",
    description: "Theme, density, reduced motion",
  },
  {
    id: "notifications",
    label: "Notifications",
    icon: "bell",
    description: "Desktop alerts + quiet hours",
  },
  {
    id: "devices",
    label: "Paired devices",
    icon: "devices",
    description: "Sessions sharing this account",
  },
  { id: "version", label: "Version", icon: "version", description: "Deck / Gateway / CLI build" },
];

const recentSaves = [
  {
    ts: Date.now() - 1000 * 60 * 7,
    actor: "operator:owner@openclaw",
    section: "appearance",
    paths: ["theme", "density"],
    ok: true,
  },
  {
    ts: Date.now() - 1000 * 60 * 60 * 3,
    actor: "operator:owner@openclaw",
    section: "notifications",
    paths: ["quietHoursEnabled", "quietHoursStart"],
    ok: true,
  },
  {
    ts: Date.now() - 1000 * 60 * 60 * 9,
    actor: "operator:owner@openclaw",
    section: "runtime",
    paths: ["gatewayUrl"],
    ok: false,
    error: "tlsVerify failed against new endpoint",
  },
];

window.SettingsData = {
  settings,
  version,
  bundledRuntime,
  remoteRuntime,
  initialBootstrap,
  remoteEndpoint,
  sections,
  recentSaves,
};

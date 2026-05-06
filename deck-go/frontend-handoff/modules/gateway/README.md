# gateway — high-fidelity handoff (v2)

**Status:** `implemented — real-contract verified`
**Protocol version:** `protocol-v1`
**Visual target:** [`./prototype.html`](./prototype.html) (multi-file Babel React)
**V1 archive:** [`./prototype-v1-codex.html`](./prototype-v1-codex.html)

`gateway/` is the deck-go **gateway control plane dashboard** — a read-only
operator cockpit answering: is the Gateway up, which channels and agents are
heartbeating, what RPC methods/events are exposed, and what just ran.

The hard rule: this is a **runtime-mode-aware** read-mostly panel. In
**bundled** mode the operator can run a safety-gated read-only `gateway.batch`
through the runtime-scoped BFF route. This is not a synthetic dry-run:
`gateway.batch` executes upstream calls, so production filters mutating methods
out of the composer. In **remote** mode the batch console remains locked — see
`states.md` for the gating matrix.

## File inventory

| File                      | Purpose                                                                                                                                                                    |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prototype.html`          | ~22-line shell loading React + Babel + 6 jsx + 2 css.                                                                                                                      |
| `data.js`                 | Mock fixture: health + status + describe (50+ methods × 6 scopes + 21 events + 2 untyped) + 4 recent batches + 30-min throughput series + 8 audit entries + bootstrap.     |
| `icons.jsx`               | 22 SVG icons + `ScopePill` (4 tones) + `SinceTag` + `ConnDot` + `SparkBar` + `SparkLine` + `formatMs` / `formatRelative` / `formatTime`.                                   |
| `describe-explorer.jsx`   | Methods+Events catalog: 2-tab mode + scope filter + search + selection drives detail card with params/result/payload JSON.                                                 |
| `batch-console.jsx`       | Recent `gateway.batch` invocations (expandable per-batch) + dry-run composer modal (3-phase wizard, 8% per-call simulated failure).                                        |
| `app.jsx`                 | `GatewayApp` orchestrator + topbar (health pill / state / runtime / Refresh) + hero (4-cell KPI + 2 rails: channels + heartbeat agents) + throughput card + 3-tab section. |
| `styles.css`              | ~620 lines control-plane dashboard + describe split-pane + batch console + composer modal + density variants + light theme stub.                                           |
| `tokens.css`              | Mirror of canonical `--ds-*` tokens.                                                                                                                                       |
| `tweaks-panel.jsx`        | Design-time state knobs (theme/density).                                                                                                                                   |
| `prototype-v1-codex.html` | Original Codex single-file prototype (425 lines).                                                                                                                          |

## Contract truth

```ts
// from deck-go/contracts/source/deck-api.contract.ts

export interface DeckGoGatewayHealthResponse {
  ok?: boolean;
  durationMs?: number;
  agents?: Array<{ sessions?: { count?: number } } | Record<string, unknown>>;
  sessions?: { count?: number; path?: string; recent?: unknown[] };
  channels?: Record<string, unknown>;
  channelLabels?: Record<string, string>;
  channelOrder?: string[];
  defaultAgentId?: string;
  heartbeatSeconds?: number;
  ts?: number;
}

export interface DeckGoGatewayStatusResponse {
  state?: string;
  channelSummary?: string[];
  heartbeat?: string | { agents?: Array<...>; defaultAgentId?: string };
  linkChannel?: { authAgeMs?: number | null; id?: string; label?: string; linked?: boolean };
  queuedSystemEvents?: string[];
  runtimeVersion?: string | null;
  sessions?: number | { byAgent?: unknown[]; count?: number; defaults?: { contextTokens?: number | null; model?: string | null }; paths?: string[]; recent?: unknown[] };
  channels?: Record<string, unknown>;
}

export interface DeckGoGatewayDescribeMethod {
  scope?: string;
  params?: Record<string, unknown>;
  result?: Record<string, unknown>;
  since?: number;
}
export interface DeckGoGatewayDescribeEvent {
  payload?: Record<string, unknown>;
  since?: number;
}
export interface DeckGoGatewayDescribeResponse {
  methods?: Record<string, DeckGoGatewayDescribeMethod>;
  events?: Record<string, DeckGoGatewayDescribeEvent>;
  untyped?: string[];
}

export interface DeckGoGatewayBatchCall { id: string; method: string; params?: unknown }
export interface DeckGoGatewayBatchOptions { failFast?: boolean; timeoutMs?: number }
export interface DeckGoGatewayBatchRequest {
  calls: DeckGoGatewayBatchCall[];
  options?: DeckGoGatewayBatchOptions;
}
export interface DeckGoGatewayBatchError {
  code: string; message: string;
  details?: unknown; retryable?: boolean; retryAfterMs?: number;
}
export interface DeckGoGatewayBatchResultEntry {
  id: string; ok: boolean; result?: unknown; error?: DeckGoGatewayBatchError;
}
export interface DeckGoGatewayBatchResponse {
  runtimeId: string; requestId: string;
  results: DeckGoGatewayBatchResultEntry[];
}
```

Endpoints (read-only + 1 mutation):

- `GET    /api/gateway/health` → `DeckGoGatewayHealthResponse`
- `GET    /api/gateway/status` → `DeckGoGatewayStatusResponse`
- `GET    /api/gateway/describe` → `DeckGoGatewayDescribeResponse`
- `POST   /api/v1/runtimes/{runtimeId}/gateway/batch` → `DeckGoGatewayBatchResponse` (bundled mode, read-only child methods only)

## Section model

```
┌─ Topbar (sticky)
│  ├─ Brand (eyebrow + title + runtime version + heartbeat seconds + ts)
│  ├─ Health pill (OK/DOWN) + state pill + bootstrap pill
│  └─ Refresh
├─ Hero
│  ├─ 4-cell KPI grid (Sessions / Channels connected/total / Agents heartbeating / Health probe ms)
│  └─ 2 rails (channels + heartbeat agents)
│     ├─ Channel summary (per-channel pill: ConnDot + label + last-seen relative)
│     └─ Heartbeat agents (per-agent pill: agentId + every X + sessions count)
├─ Throughput (BFF projection — flagged in api-usage.md)
│  └─ 4-cell grid (Requests/min count + bar spark / Error rate % + spark / Latency p95 ms + line spark / Queued events)
└─ Tabs section (3 tabs)
   ├─ Methods & Events: DescribeExplorer (split-pane: filtered list + detail JSON)
   ├─ Batch console: Recent batches (expandable) + bundled-only read-only composer
   └─ Activity: Recent audit entries (BFF projection — flagged in api-usage.md)
```

## Runtime-mode awareness

This panel cross-cuts the deck-go runtime-mode contract (`bundled` vs
`remote`). Per `RUNTIME_MODE`:

| Section          | Bundled mode              | Remote mode                                      |
| ---------------- | ------------------------- | ------------------------------------------------ |
| Topbar Refresh   | ✓ refetches health+status | ✓ refetches health+status                        |
| Hero KPI + rails | ✓ live                    | ✓ live (latency may be higher)                   |
| Throughput       | ✓ live                    | ✓ live                                           |
| Methods & Events | ✓ readable                | ✓ readable                                       |
| Batch console    | ✓ read-only methods only  | ❌ disabled (locked button + tooltip explaining) |
| Activity audit   | ✓ readable                | ✓ readable (server-side audit travels)           |

The mode comes from runtime capabilities plus runtime summary. The prototype
defaults to bundled-with-batch-enabled to demo all surfaces. Production gates
batch submission on `runtimeMode === "bundled"` and advertised read-only
methods from `gateway.describe`.

See `docs/superpowers/specs/2026-04-28-runtime-mode-decoupling-design.md`
for the canonical mode contract.

## Depends on canonical patterns / icons

`@/design-system/patterns`:

- `PageShell`, `EmptyState`, `KbdHint`, `SectionHeader`.

`@/design-system/icons`:

- `IconRefresh`, `IconClose`, `IconAlert`, `IconCheck`, `IconBolt`,
  `IconActivity`, `IconSearch`, `IconClock`, `IconHash`, `IconShield`,
  `IconChevronR`, `IconChevronD`, `IconLayers`, `IconChannel`,
  `IconWrench`, `IconHeart`, `IconPlay`, `IconCopy`, `IconExternal`,
  `IconBook`.

No new chart dependency was added in production. The prototype's `SparkBar` and
`SparkLine` currently translate to compact inline SVG bars using design-system
tokens.

`ScopePill`, `SinceTag`, `ConnDot` stay local to gateway. **`ScopePill` is
a strong promotion candidate** — any panel surfacing per-method auth scope
will need it (api-explorer US-019, plugins US-003).

## How to implement

1. Open `prototype.html` in a static server. Walk all 3 tabs. Click
   batches to expand. Trigger dry-run composer. Use Tweaks for theme/density.
2. Translate to `frontend-new/src/components/panels/gateway/` keeping
   class-name shape (`gateway-app__*`, `describe-row__*`, `batch-row__*`,
   `throughput-card__*`).
3. Wire real fetchers in `frontend-new/src/api.ts`:
   - `fetchGatewayHealth()` → `GET /api/gateway/health`
   - `fetchGatewayStatus()` → `GET /api/gateway/status`
   - `fetchGatewayDescribe()` → `GET /api/gateway/describe`
   - `submitGatewayBatch(req, { runtimeId })` → `POST /api/v1/runtimes/{runtimeId}/gateway/batch` (bundled/read-only gated)
4. Keep throughput as a clearly labeled BFF/UI projection until a durable
   Gateway throughput contract exists.
5. Hide batch composer trigger when `runtimeMode === "remote"`.
6. Hardcoded literal strings get extracted to
   `frontend-new/src/i18n/{en,zh}.json`.
7. Throughput card data is a **BFF projection** (not part of describe
   contract). The BFF should compute per-minute buckets from recent batch
   timing. Future: contract should publish a `gateway.throughput` method
   so this becomes typed.

## Stack decisions punted from this panel

- **Live updates** — prototype is snapshot. Production may want WebSocket
  or SSE push for throughput + audit log. Not in current contract;
  defer to a future `gateway.events.subscribe` endpoint or reuse the
  existing event subscription mechanism.
- **Batch composer ergonomics** — prototype uses plain `<input>` for
  method + JSON params. Production may want a dropdown sourced from
  `describe.methods` keys + a JSON validator. Not blocking.
- **Audit pagination** — prototype shows last 8 entries. Production
  should paginate / virtualize when audit count > 50.

## Unsupported claims

- Do not claim throughput is real per-second streaming — current
  contract has no streaming RPC for throughput; the BFF projects it.
- Do not claim describe is exhaustive — `untyped[]` lists methods that
  exist but lack params/result schema.
- Do not claim batch is a dry-run — it is a real Gateway execution surface and
  this panel only exposes read-only child methods.
- Do not claim batch failures retry automatically — `retryable: true` is
  advisory; the operator must resubmit.

## Open questions for follow-up

1. **Throughput contract** — should the contract gain
   `GET /api/gateway/throughput?window=30m` returning typed time-series?
2. **Live updates** — should `gateway.events` (currently a describe
   listing only) gain a real subscription endpoint so the panel
   doesn't poll?
3. **Audit endpoint** — `recentActivity` is a BFF projection over the
   gateway audit log. Should the contract gain
   `GET /api/gateway/activity?limit=N` so it becomes typed?
4. **Batch in remote mode** — should remote-mode operators be able to
   dry-run batches against the connected remote Gateway? Currently
   gated to bundled only. The contract supports it; the UX risk is
   accidentally writing to a production remote.
5. **Untyped methods governance** — should the contract require all
   methods to publish params/result schemas, deprecating the
   `untyped[]` field?

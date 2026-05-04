# approvals — high-fidelity handoff (v2)

**Status:** `revised v2 — pending implementation`
**Protocol version:** `protocol-v1`
**Visual target:** [`./prototype.html`](./prototype.html) (multi-file Babel React)
**V1 archive:** [`./prototype-v1-codex.html`](./prototype-v1-codex.html)

`approvals/` is the deck-go **security operations workspace** — operators
inspect pending exec + plugin approvals, decide allow once / allow always /
deny with optional reason, and edit the approval policy (defaults + per-agent
overrides + allowlist).

The hard rule: this is a **decision-critical** panel. Pending approvals have
a 60s expiry timer; expired entries auto-deny. The decision bar is always
visible while an entry is selected.

## File inventory

| File                      | Purpose                                                                                                                    |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `prototype.html`          | ~22-line shell loading React + Babel + 5 jsx + 2 css.                                                                      |
| `data.js`                 | Mock fixture: policy + 4 pending exec + 2 pending plugin + 12 recent decisions + KPI stats + bootstrap.                    |
| `icons.jsx`               | 16 SVG icons + `KindBadge` + `DecisionBadge` + `CountdownTimer` (live ticking) + `CommandTag` + 2 formatters.              |
| `queue-list.jsx`          | Left pane: kind filter (All/Exec/Plugin) + search + per-row countdown + click-to-select.                                   |
| `approval-detail.jsx`     | Right pane: hero + 4 tabs (Overview/Argv/Plan or Scopes/Source/Activity) + DecisionBar (allow once / allow always / deny). |
| `policy-editor.jsx`       | Modal for `DeckGoApprovalPolicy` editing: defaults + per-agent overrides + allowlist add/remove.                           |
| `app.jsx`                 | `ApprovalsApp` orchestrator + topbar (5-cell KPI + Policy + Refresh) + 2-pane main + recent-decisions strip.               |
| `styles.css`              | ~620 lines security ops dashboard + countdown pulse + decision bar + modal + density variants + light theme stub.          |
| `tokens.css`              | Mirror of canonical `--ds-*` tokens.                                                                                       |
| `tweaks-panel.jsx`        | Design-time state knobs (theme/density).                                                                                   |
| `prototype-v1-codex.html` | Original Codex single-file prototype (425 lines).                                                                          |

## Contract truth

```ts
// from deck-go/contracts/source/deck-api.contract.ts

export type DeckGoApprovalPolicyDefaults = {
  security?: "deny" | "allowlist" | "full";
  ask?: "off" | "on-miss" | "always";
  askFallback?: "deny" | "allowlist" | "full";
  autoAllowSkills?: boolean;
};

export type DeckGoApprovalPolicy = {
  defaults: DeckGoApprovalPolicyDefaults;
  agents: Record<string, DeckGoApprovalPolicyDefaults>;
  allowlist: string[];
};

export type DeckGoApprovalPolicyResponse = {
  hash?: string;
  file?: {
    defaults?: DeckGoApprovalPolicyDefaults;
    agents?: Record<string, DeckGoApprovalPolicyDefaults>;
    allowlist?: string[];
  };
};

export type DeckGoPendingApproval = {
  id: string;
  command: string;
  commandArgv?: string[];
  agentId?: string;
  sessionKey?: string;
  runId?: string;
  cwd?: string;
  createdAtMs: number;
  expiresAtMs: number;
};

export type DeckGoPendingApprovalsResponse = {
  pending?: DeckGoPendingApproval[];
};

export type DeckGoPluginApprovalEntry = {
  id: string;
  pluginId: string;
  pluginName?: string;
  capabilityKind: "channel" | "tool" | "agent" | "provider";
  requestedScopes?: string[];
  origin: "bundled" | "extension";
  sourceUrl?: string;
  createdAtMs: number;
  requester?: string;
};

export type DeckGoPluginApprovalsResponse =
  | DeckGoPluginApprovalEntry[]
  | { entries?: DeckGoPluginApprovalEntry[] };
```

Endpoints:

- `GET    /api/approvals/policy` → `DeckGoApprovalPolicyResponse`
- `PUT    /api/approvals/policy` → mutation (replace policy, returns new hash)
- `GET    /api/approvals/pending` → `DeckGoPendingApprovalsResponse`
- `POST   /api/approvals` → resolve exec approval (`{ id, decision, reason? }`)
- `GET    /api/approvals/plugins` → `DeckGoPluginApprovalsResponse`
- `POST   /api/approvals/plugins` → resolve plugin approval (`{ id, decision, reason? }`)

Stream events (typed): `approval.pending` and `approval.resolved` arrive
through `useApprovalsStream`.

Typed Gateway methods: `exec.approvals.get`, `exec.approvals.set`,
`exec.approval.resolve`, `plugin.approval.resolve`.

Untyped upstream-schema exceptions: `exec.approval.list` and
`plugin.approval.list` — listed in describe `untyped[]`.

## Section model

```
┌─ Topbar (sticky)
│  ├─ Brand (eyebrow + title + policy hash + runtime version)
│  ├─ KPI strip (Pending exec / Pending plugin / Resolved 1h / Denied 1h / Avg response)
│  └─ Policy editor + Refresh
├─ Main 2-pane
│  ├─ Queue list (left ~360px)
│  │  └─ Kind filter (All/Exec/Plugin) + search + ordered-by-expiry rows
│  └─ Approval detail (right)
│     ├─ Hero (kind + id + countdown + command/plugin name + meta cells)
│     ├─ Tabs: exec → Overview / Argv / Plan / Activity
│     │       plugin → Overview / Scopes / Source / Activity
│     └─ Decision bar (reason + Deny / Allow once / Allow always)
└─ Recent decisions strip (last 12, fade-in)
```

## Read-only safety + intentional mutations

This panel is **decision-critical**: every interaction either records a
decision in audit or modifies the policy file. The contract is intentionally
mutation-heavy:

| Surface       | Mutation                              | Notes                                          |
| ------------- | ------------------------------------- | ---------------------------------------------- |
| Decision bar  | `POST /api/approvals` (or `/plugins`) | Required action. No "save draft."              |
| Policy editor | `PUT /api/approvals/policy`           | Replaces the whole policy file. Hash returned. |
| Allowlist add | Same as above                         | Editing through policy editor only.            |

No silent side effects: the recent-decisions strip is purely a read
projection of what just happened.

## Depends on canonical patterns / icons

`@/design-system/patterns`:

- `PageShell`, `EmptyState`, `KbdHint`, `SectionHeader`.

`@/design-system/icons`:

- `IconShield`, `IconCheck`, `IconClose`, `IconAlert`, `IconClock`,
  `IconBolt`, `IconRefresh`, `IconTerminal`, `IconPlug`, `IconUser`,
  `IconHistory`, `IconSettings`, `IconChevronD`, `IconCopy`, `IconSearch`.

`KindBadge`, `DecisionBadge`, `CommandTag` stay local to approvals (highly
domain-specific).

`CountdownTimer` is a **promotion candidate** — cron next-run countdown
(US-017), webhook delivery retry windows (US-018), session expiry banners
all need the same live-ticking pattern.

## How to implement

1. Open `prototype.html` in a static server. Click queue rows. Decide one
   of them. Open the policy editor and adjust defaults + agent override +
   allowlist. Use Tweaks for theme/density.
2. Translate to `frontend-new/src/components/panels/approvals/` keeping
   class-name shape (`approvals-app__*`, `queue-row__*`,
   `approval-detail__*`, `decision-bar__*`).
3. Wire real fetcher in `frontend-new/src/api/approvals.ts`:
   - `fetchApprovalsPolicy()` → `GET /api/approvals/policy`
   - `updateApprovalsPolicy(file)` → `PUT /api/approvals/policy`
   - `fetchPendingApprovals()` → `GET /api/approvals/pending`
   - `resolveApproval(id, decision, reason?)` → `POST /api/approvals`
   - `fetchPluginApprovals()` → `GET /api/approvals/plugins`
   - `resolvePluginApproval(id, decision, reason?)` → `POST /api/approvals/plugins`
4. Wire `useApprovalsStream` over `streamEvents` for `approval.pending` /
   `approval.resolved` to push real-time queue updates.
5. `CountdownTimer` uses `setInterval(force, 500)` for half-second granularity;
   in production consider `requestAnimationFrame` or `setTimeout` chained on
   the actual `expiresAtMs` for accuracy.
6. Hardcoded literal strings get extracted to
   `frontend-new/src/i18n/{en,zh}.json`.
7. Recent-decisions strip is a **BFF projection** over the audit log
   (`exec.approval.list` is untyped — frontend treats it as opaque shape).

## Stack decisions punted from this panel

- **Real-time queue refresh** — prototype is snapshot-based but live-ticks
  countdowns. Production should use the SSE/WS stream to push new pending
  approvals without operator-Refresh.
- **Bulk actions** — prototype is one-at-a-time. Production may want
  shift-click multi-select + bulk Allow/Deny.
- **Decision-keystroke shortcuts** — `A` allow once / `D` deny / `Shift+A`
  allow always — not in prototype; production target.

## Unsupported claims

- Do not claim countdowns are server-authoritative — they're computed from
  `expiresAtMs` which is set at approval creation; clock skew exists.
- Do not claim allow-always permanently allowlists — the operator may revoke
  via policy editor; allowlist is a list, not a guarantee.
- Do not claim plugin approvals carry full manifest — `pluginName` is the
  display field; full manifest is a separate `plugin.manifest` RPC.

## Open questions for follow-up

1. **Stream event shape** — `approval.pending` and `approval.resolved` are
   typed but their `payload` field is partially open. Should the contract
   tighten to a closed union per kind (exec vs plugin)?
2. **Reason field length cap** — the contract doesn't specify max length.
   200 chars seems sane; should it be enforced server-side?
3. **Allow-always scope** — does it scope to (agent, command) tuple or just
   command? Current behavior is global allowlist (just command); consider
   per-agent allowlist.
4. **Bulk decision endpoint** — should `POST /api/approvals/bulk` accept
   `[{id, decision, reason}, ...]`?
5. **Audit pagination** — recent-decisions is last 12; production needs
   pagination + filter by agent/decision/actor.

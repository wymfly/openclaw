# approvals — api usage

## Source authority

Deck-facing DTO authority lives in:

- `contracts/source/deck-api.contract.ts`
- generated TypeScript: `contracts/generated/ts/deck-api.generated.ts`
- frontend re-exports: `frontend-new/src/api-types.ts`

Approval-related Gateway methods (typed):

- `exec.approvals.get`
- `exec.approvals.set`
- `exec.approval.resolve`
- `plugin.approval.resolve`

Approval-related Gateway methods (untyped — listed in describe `untyped[]`):

- `exec.approval.list`
- `plugin.approval.list`

Endpoint classification lives in:

- `contracts/source/deck-endpoints.contract.json`

## Frontend wrappers

`ApprovalsPanel` should use:

- `fetchApprovalsPolicy()` → `GET /api/approvals/policy`
- `updateApprovalsPolicy(file)` → `PUT /api/approvals/policy`
- `fetchPendingApprovals()` → `GET /api/approvals/pending`
- `resolveApproval(id, decision)` → `POST /api/approvals`
- `fetchPluginApprovals()` → `GET /api/approvals/plugins`
- `resolvePluginApproval(id, decision)` → `POST /api/approvals/plugins`
- `useApprovalsStream()` over `streamEvents` (typed `approval.pending` and
  `approval.resolved` event payloads)

## Backend routes

| UI need                  | Frontend wrapper                              | Deck route                    | Notes                                                                                                               |
| ------------------------ | --------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Approval policy          | `fetchApprovalsPolicy()`                      | `GET /api/approvals/policy`   | Returns `DeckGoApprovalPolicyResponse` with hash + file.                                                            |
| Update policy            | `updateApprovalsPolicy(file)`                 | `PUT /api/approvals/policy`   | Body matches `file`; returns new hash. Optimistic concurrency: server may reject if hash mismatched.                |
| Pending exec approvals   | `fetchPendingApprovals()`                     | `GET /api/approvals/pending`  | Returns `DeckGoPendingApprovalsResponse`.                                                                           |
| Resolve exec approval    | `resolveApproval(id, decision)`               | `POST /api/approvals`         | Body: `{ id, decision: "allow-once" \| "allow-always" \| "deny" }`. Current Gateway params do not include `reason`. |
| Pending plugin approvals | `fetchPluginApprovals()`                      | `GET /api/approvals/plugins`  | Returns `DeckGoPluginApprovalsResponse` (array OR `{ entries: [] }`).                                               |
| Resolve plugin approval  | `resolvePluginApproval(id, decision)`         | `POST /api/approvals/plugins` | Body: `{ id, decision: "allow-once" \| "allow-always" \| "deny" }`. Current Gateway params do not include `reason`. |
| Stream                   | `useApprovalsStream()`                        | `GET /api/stream`             | Filters for `approval.pending` and `approval.resolved` event kinds.                                                 |
| Bootstrap                | `useDeckUI()` / `fetchRuntimeGatewayStatus()` | `GET /api/bootstrap/status`   | Runtime version + heartbeat seconds for topbar subtitle.                                                            |
| Recent decisions audit   | `fetchActivityEvents(limit)` (BFF projection) | `GET /api/activity?limit=20`  | Filtered by `event.kind LIKE 'approval.%'`. **BFF projection — not part of approvals contract.**                    |

## DTO summary

```ts
// from deck-go/contracts/source/deck-api.contract.ts (lines 1336-1372, 617-633)

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

export interface DeckGoPluginApprovalEntry {
  id: string;
  pluginId?: string;
  command?: string;
  description?: string;
  createdAtMs?: number;
  expiresAtMs?: number;
  status?: string;
  decision?: string | null;
}

export type DeckGoPluginApprovalsResponse =
  | DeckGoPluginApprovalEntry[]
  | { entries?: DeckGoPluginApprovalEntry[] };
```

## Mock fixture notes

The bundled mock Gateway provides:

- `exec.approvals.get` / `exec.approvals.set` (typed)
- `exec.approval.resolve` (typed)
- `plugin.approval.resolve` (typed)
- `exec.approval.list` / `plugin.approval.list` (untyped — opaque shape)

For L1 visual E2E:

- Seed `approval.pending` events through the mock Gateway subscription
  path so the queue receives entries in real time.
- Seed `approval.resolved` events for previously-decided approvals so
  the recent-decisions strip populates.
- Mock allowlist add / remove operations through `PUT /api/approvals/policy`
  with synthetic hash bumps.

This is mock visual coverage only. It does not prove real OpenClaw
exec approval semantics.

## BFF projections (flagged)

The following surfaces are **NOT** part of the approvals contract — they
are Deck backend projections over the event bus + audit log:

| Surface                 | Projected from                                                     |
| ----------------------- | ------------------------------------------------------------------ |
| Recent decisions strip  | `GET /api/activity?limit=20` filtered by `approval.*` event kinds. |
| KPI: Resolved last hour | Aggregate over `approval.resolved` events in last 60min.           |
| KPI: Denied last hour   | Same, filtered by `decision === "deny"`.                           |
| KPI: Avg response sec   | `(decidedAtMs - createdAtMs) / 1000` averaged over last 60min.     |
| KPI: Expired last hour  | Aggregate over `approval.resolved` with `decision === "expired"`.  |

Production target: contract should publish a typed
`approvals.summary` RPC returning the aggregated stats so KPIs are not
client-computed.

## Stack decisions punted

- **Real-time queue refresh** — prototype is snapshot-based but live-ticks
  countdowns. Production should use the SSE/WS stream to push new pending
  approvals without operator-Refresh.
- **Bulk actions** — prototype is one-at-a-time. Production may want
  shift-click multi-select + bulk Allow/Deny via a hypothetical
  `POST /api/approvals/bulk` (not in current contract).
- **Decision keystroke shortcuts** — `A` / `D` / `Shift+A` are production
  targets, not in prototype.
- **Optimistic concurrency** — `PUT /api/approvals/policy` returns a new
  hash; production should compare the operator's draft hash against
  current to detect conflicting edits.

## Open contract assumptions

These match README §"Open questions for follow-up":

1. **Stream event payload shape** — `approval.pending` and `approval.resolved`
   event payload fields are partially open. Should the contract tighten
   to a closed union per kind (exec vs plugin)?
2. **Reason field support** — current generated Gateway resolve params contain
   only `id` and `decision`, so reason capture is intentionally disabled in
   production until Gateway exposes a supported field.
3. **Allow-always scope** — does it scope to (agent, command) tuple or just
   command? Current behavior is global allowlist (just command); consider
   per-agent allowlist.
4. **Bulk decision endpoint** — should `POST /api/approvals/bulk` accept
   `[{id, decision, reason}, ...]`?
5. **Audit pagination** — recent-decisions is last 12; production needs
   pagination + filter by agent/decision/actor.

## Known uncertainty

- Real Gateway event coverage for `approval.pending` is not yet audited
  in this module pass.
- Upstream approval decisions are hyphenated values (`allow-once`,
  `allow-always`, `deny`). Older prototype text using underscore values is
  presentation-only and must not be sent to the Gateway.
- The two untyped methods (`exec.approval.list` and `plugin.approval.list`)
  return opaque shapes — frontend treats them as `Record<string, unknown>`
  and only reads keys that the BFF normalizes into recent-decisions.

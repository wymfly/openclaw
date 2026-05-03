# budget — API usage (v2)

> Endpoint truth and DTO shapes are tracked in
> `deck-go/contracts/source/deck-api.contract.ts` and
> `deck-go/contracts/source/deck-endpoints.contract.json`.

## Source of truth

The budget module reads rules + evaluations from the deck-go BFF, which
forwards to upstream OpenClaw `gateway.usage.budget.*` Gateway methods.
Browser code never calls Gateway directly.

## Deck-facing API

### `GET /api/usage/budget`

Wrapper:

```ts
fetchBudgetRules(): Promise<DeckGoBudgetRulesResponse>
```

Response:

```ts
type DeckGoBudgetRulesResponse = { rules: DeckGoBudgetRule[] };
```

`DeckGoBudgetRule`:

```ts
type DeckGoBudgetRule = {
  id: string;
  name: string;
  scope: string; // "global" | "workspace" | "agent" | "task" | "channel"
  agentId: string | null;
  taskId: string | null;
  dimension: "tokensIn" | "tokensOut" | "totalTokens" | "cost";
  warnThreshold: number | null;
  overThreshold: number | null;
  period: string; // "minute" | "hour" | "day" | "week" | "month" | "task"
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};
```

The contract leaves `scope` and `period` as open strings; the prototype
hardcodes the 5/6 enums it expects.

### `GET /api/usage/budget/evaluate`

Wrapper:

```ts
evaluateBudgetRules(): Promise<DeckGoBudgetEvaluationsResponse>
```

Response:

```ts
type DeckGoBudgetEvaluationsResponse = { evaluations: DeckGoBudgetEvaluation[] };
type DeckGoBudgetEvaluation = {
  ruleId: string;
  ruleName: string;
  status: "ok" | "warn" | "over";
  current: number;
  warnThreshold: number | null;
  overThreshold: number | null;
  dimension: "tokensIn" | "tokensOut" | "totalTokens" | "cost";
};
```

Server snapshots current usage against rule thresholds and returns one
evaluation per rule. Disabled rules MAY be omitted by the server; the
UI tolerates missing evaluations (renders KPI cells as "—").

There is **no time-series in this response** — `current` is a single
point. Time-series rendering belongs to **US-014 usage**.

The frontend wrapper normalizes legacy `currentValue` into `current` for
backward-compat with old fixtures.

### `POST /api/usage/budget`

Wrapper:

```ts
createBudgetRule(input: BudgetRuleInput): Promise<DeckGoBudgetRule>
```

Body: omits `id` / `createdAt` / `updatedAt`. Required practical fields
are `name` and `dimension`; the form also provides `scope`, `period`,
`enabled`, and optional thresholds.

Response: refreshed `DeckGoBudgetRule` with server-assigned `id` +
timestamps.

Errors:

- `400 Bad Request` — validation. UI surfaces field error inline.
- `409 Conflict` — name collision. UI surfaces "name already in use".
- `5xx` — generic. Dialog `phase--error`.

After successful create, the panel refetches `evaluate` so the new
rule's status pill renders.

### `PATCH /api/usage/budget/{ruleId}`

Wrapper:

```ts
updateBudgetRule(id: string, input: Partial<BudgetRuleInput>): Promise<DeckGoBudgetRule>
```

Body: partial rule update.

Response: refreshed rule.

After successful patch, the panel refetches `evaluate` so the updated
threshold values immediately recolor the meter and KPI strip.

The prototype simulates a 10% rejection per edit ("validation: warn
must be < over"); production should also pre-check this client-side.

### `DELETE /api/usage/budget/{ruleId}`

Wrapper:

```ts
deleteBudgetRule(id: string): Promise<void>
```

Response: 204 No Content.

After successful delete, the panel refetches `rules` + `evaluate`. The
selected rule is replaced with the first remaining rule (or `null` if
list is empty).

### `GET /api/bootstrap/status`

The budget module reads `bootstrap.ok` to gate mutations (see
`states.md`). Same shape as in settings panel.

## DTO shapes (canonical)

```ts
type DeckGoBudgetDimension = "tokensIn" | "tokensOut" | "totalTokens" | "cost";
type DeckGoBudgetStatus = "ok" | "warn" | "over";
type DeckGoBudgetRule = {
  /* see above */
};
type DeckGoBudgetEvaluation = {
  /* see above */
};
type DeckGoBudgetRulesResponse = {
  /* see above */
};
type DeckGoBudgetEvaluationsResponse = {
  /* see above */
};
```

## BFF projections (not part of the contract)

### `recentChanges: ChangeEvent[]`

```ts
interface ChangeEvent {
  ts: number;
  actor: string; // "operator:user@example.com" | "system" | "automation:..."
  ruleId: string;
  kind: "update" | "create" | "delete" | "enable" | "disable";
  note: string; // free-form ("warn threshold 6.5 → 8.0")
  ok: boolean;
  error?: string;
}
```

BFF projection over the BFF audit log. The prototype shows the last 8
entries scoped to the selected rule.

### `agentDirectory: { id; label }[]`

The prototype enriches the agent select in dialogs with a label
("Daisy 🌼") fetched from the agents panel data. This is a client-side
join, not a contract-required field.

## Endpoint summary

| Endpoint                     | Method | When                                      | DTO                               |
| ---------------------------- | ------ | ----------------------------------------- | --------------------------------- |
| `/api/usage/budget`          | GET    | Initial load + Refresh                    | `DeckGoBudgetRulesResponse`       |
| `/api/usage/budget/evaluate` | GET    | Initial load + per-mutation refresh       | `DeckGoBudgetEvaluationsResponse` |
| `/api/usage/budget`          | POST   | CreateRuleDialog confirm                  | `DeckGoBudgetRule` (refreshed)    |
| `/api/usage/budget/{ruleId}` | PATCH  | EditRuleDialog / ToggleRuleDialog confirm | `DeckGoBudgetRule` (refreshed)    |
| `/api/usage/budget/{ruleId}` | DELETE | DeleteRuleDialog confirm                  | (204 No Content)                  |
| `/api/bootstrap/status`      | GET    | Page load + 30s poll                      | `DeckGoBootstrapStatusResponse`   |

## Backend chain

```
BudgetApp
  → frontend-new/src/api/budget.ts
  → deck-go Go BFF routes
    ├── deck-go/backend/internal/server/budget.go (rule CRUD handlers)
    ├── Gateway typed client: usage.budget.list / usage.budget.evaluate / usage.budget.upsert / usage.budget.delete
    └── BFF projection: recentChanges (audit log) + agentDirectory join
  → Gateway (only via the BFF / runtime boundary)
```

## Mock requirements

- 7 rules across 4 dimensions × 5 scopes × 6 periods. At minimum:
  - 1 cost rule (workspace, monthly) — boundary: large numeric range.
  - 1 cost rule (per-task, hourly) — boundary: small numeric range.
  - 1 tokensIn rule (per-agent, daily) — disabled, exercises disabled rendering.
  - 1 tokensOut rule (per-agent, hourly) — typical happy path.
  - 1 totalTokens rule (per-agent, weekly).
  - 1 tokensOut rule (per-channel, hourly) — exercises channel scope.
  - 1 cost rule (global, daily) — exercises global scope.
- 7 evaluations to match rules: at least 1 ok / 2 warn / 1 over to
  exercise all status tones.
- 4 recentChanges: 3 ok across kinds (update/create/disable) + 1 from
  automation actor.
- `bootstrap.ok === true` by default.
- `agentDirectory` includes 5 agents (matching seed agentIds).

## Stack decisions punted to engineering

- **Form library**: prototype uses plain `useState` for the 8-field
  RuleForm. Production may swap to `react-hook-form` for consistency
  with config / alerts panels. Not blocking; both work with the schema.
- **Chart library**: this panel does NOT need a chart library —
  threshold meter is CSS-only. The chart-lib decision is the **usage
  panel's** (US-014) to make. If usage locks `recharts`, the same lib
  serves any future budget-history view.
- **Optimistic updates**: prototype waits for the simulated server
  response before updating local state. Production may want optimistic
  updates with rollback on failure for sub-second UX, but it's not
  required.

## Unsupported claims

- Do not claim real billing accuracy.
- Do not claim production quota enforcement.
- Do not claim organization or workspace billing policy.
- Do not infer model/provider cost rules beyond what usage totals expose.

## Open contract assumptions

- **`scope` and `period` open enums** — should the contract enum
  these? See open question §3 in README.
- **`projection` for forecast** — not in contract today. See open
  question §1 in README.
- **`history` per rule** — not in contract today. See open question §2
  in README.
- **`recentChanges`** — BFF-projected. Should the contract gain
  `GET /api/usage/budget/{ruleId}/changes?limit=N`?
- **`notifyRuleId`** linking budget rules to alert rules — not in
  contract. See open question §5 in README.

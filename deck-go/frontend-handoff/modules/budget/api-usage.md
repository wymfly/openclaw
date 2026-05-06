# budget — API usage (v2)

> Endpoint truth and DTO shapes are tracked in
> `deck-go/contracts/source/deck-api.contract.ts` and
> `deck-go/contracts/source/deck-endpoints.contract.json`.

## Source of truth

The budget module reads rules + evaluations from the deck-go BFF. Budget
rule CRUD is a Deck-local policy layer stored in `localstore`, and
evaluation combines enabled local rules with managed runtime `usage.cost`
totals. Browser code never calls Gateway directly, and current code does
not implement upstream OpenClaw `gateway.usage.budget.*` Gateway methods.

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
  scope: string; // open string; production UI currently authors "global" | "agent" | "task"
  agentId: string | null;
  taskId: string | null;
  dimension: "tokensIn" | "tokensOut" | "totalTokens" | "cost";
  warnThreshold: number | null;
  overThreshold: number | null;
  period: string; // open string; Go BFF currently validates "daily" | "weekly" | "monthly"
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};
```

The contract leaves `scope` and `period` as open strings. The prototype
explores broader scope/period values, but production support is currently
`global | agent | task` plus `daily | weekly | monthly`.

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

Response: HTTP 200 with `{ "deleted": true }`.

After successful delete, the panel refetches `rules` + `evaluate`. The
selected rule is replaced with the first remaining rule (or `null` if
list is empty).

### `GET /api/bootstrap/status`

The prototype models `bootstrap.ok` to gate mutations. Production Budget
does not currently depend on a Budget-specific bootstrap contract beyond
normal deck-go runtime readiness and API authorization.

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

Prototype/local-only state. There is no durable Budget recent-changes
BFF endpoint or audit projection in the current contract.

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
| `/api/usage/budget/{ruleId}` | DELETE | DeleteRuleDialog confirm                  | `{deleted:true}`                  |
| `/api/bootstrap/status`      | GET    | Page load + 30s poll                      | `DeckGoBootstrapStatusResponse`   |

## Backend chain

```
BudgetApp
  → frontend-new/src/api.ts
  → deck-go Go BFF routes
    ├── deck-go/backend/internal/server/budget.go (Deck-local rule CRUD handlers)
    ├── deck-go/backend/internal/localstore/budget.go (budget-rules.json)
    ├── managed runtime UsageCost(ctx, { days: 30 }) for evaluation totals
    └── events bus publishes budget.warn / budget.over when evaluations cross thresholds
  → Gateway only through managed runtime usage.cost for evaluation data
```

## Mock requirements

These requirements describe the high-fidelity prototype breadth. Production
mock/E2E fixtures should stay inside current BFF-supported values unless a
contract change adds the broader periods/scopes.

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

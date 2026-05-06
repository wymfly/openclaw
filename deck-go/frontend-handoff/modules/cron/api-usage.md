# cron — api usage

## Source authority

Deck-facing DTO authority lives in:

- `contracts/source/deck-api.contract.ts` (lines 1374-1457)
- generated TypeScript: `contracts/generated/ts/deck-api.generated.ts`
- frontend re-exports: `frontend-new/src/api-types.ts`

Endpoint classification lives in:

- `contracts/source/deck-endpoints.contract.json`

Cron-related Gateway methods (typed): `cron.status`, `cron.list`,
`cron.add`, `cron.update`, `cron.remove`, `cron.run`, `cron.runs`.

## Frontend wrappers

`CronPanel` should use:

- `fetchCronStatus()` → `GET /api/cron/status`
- `fetchCronJobs(params)` → `GET /api/cron`
- `createCronJob(input)` → `POST /api/cron`
- `updateCronJob(id, input)` → `PATCH /api/cron/:id`
- `deleteCronJob(id)` → `DELETE /api/cron/:id`
- `runCronJob(id, mode?)` → `POST /api/cron/:id/run`
- `fetchCronRuns(jobId, params)` → `GET /api/cron/:id/runs`

## Backend routes

| UI need               | Frontend wrapper                              | Deck route                  | Notes                                                                |
| --------------------- | --------------------------------------------- | --------------------------- | -------------------------------------------------------------------- |
| Cron scheduler status | `fetchCronStatus()`                           | `GET /api/cron/status`      | Returns `DeckGoCronStatus { running, jobCount, nextRunAtMs }`.       |
| Job list              | `fetchCronJobs(params)`                       | `GET /api/cron`             | Returns `DeckGoCronJobsResponse`. Filter via `DeckGoCronJobsParams`. |
| Create job            | `createCronJob(input)`                        | `POST /api/cron`            | Body: `DeckGoCronJobInput`. Returns the created `DeckGoCronJob`.     |
| Update job            | `updateCronJob(id, input)`                    | `PATCH /api/cron/:id`       | Body: partial `DeckGoCronJobInput` (or full). Returns updated job.   |
| Delete job            | `deleteCronJob(id)`                           | `DELETE /api/cron/:id`      | No body. Returns the Gateway/BFF delete payload.                     |
| Run now               | `runCronJob(id, mode)`                        | `POST /api/cron/:id/run`    | Body: `DeckGoCronRunParams { mode: "due" \| "force" }`.              |
| Run history           | `fetchCronRuns(jobId, params)`                | `GET /api/cron/:id/runs`    | Returns `DeckGoCronRunsResponse`. Filter via `DeckGoCronRunsParams`. |
| Bootstrap             | `useDeckUI()` / `fetchRuntimeGatewayStatus()` | `GET /api/bootstrap/status` | Runtime version + heartbeat seconds for topbar subtitle.             |

## DTO summary

```ts
// from deck-go/contracts/source/deck-api.contract.ts (lines 1374-1457)

export type DeckGoCronSchedule = {
  kind: "at" | "every" | "cron";
  at?: string; // ISO datetime for one-shot
  everyMs?: number; // interval in ms for "every"
  anchorMs?: number; // anchor point for "every"
  expr?: string; // 5-field cron expr
  tz?: string; // IANA timezone (default UTC)
  staggerMs?: number; // jitter for "every"
};

export type DeckGoCronJob = {
  id: string;
  name: string;
  schedule: DeckGoCronSchedule;
  sessionTarget?: string;
  wakeMode?: string; // "now" | "next-heartbeat"
  payload: { kind: "systemEvent" | "agentTurn"; [key: string]: unknown };
  delivery?: unknown; // Untyped — per-payload-kind
  failureAlert?: boolean;
  agentId?: string;
  description?: string;
  enabled: boolean;
  deleteAfterRun?: boolean;
  nextRunAtMs?: number; // server-computed; null when disabled
  updatedAtMs?: number;
  createdAtMs?: number;
};

export type DeckGoCronJobInput = {
  name: string;
  schedule: DeckGoCronSchedule;
  sessionTarget: string;
  wakeMode: string;
  payload: { kind: "systemEvent" | "agentTurn"; [key: string]: unknown };
  agentId?: string;
  description?: string;
  enabled?: boolean;
};

export type DeckGoCronRunEntry = {
  id: string;
  jobId: string;
  status: "ok" | "error" | "skipped";
  ts: number;
  runAtMs?: number;
  durationMs?: number;
  delivery?: unknown;
  error?: string;
};

export type DeckGoCronStatus = {
  running: boolean;
  jobCount?: number;
  nextRunAtMs?: number;
};

export type DeckGoCronJobsResponse = { jobs?: DeckGoCronJob[] };
export type DeckGoCronRunsResponse = { entries?: DeckGoCronRunEntry[] };

export type DeckGoCronJobsParams = {
  includeDisabled?: boolean;
  limit?: number;
  offset?: number;
  query?: string;
  enabled?: "all" | "enabled" | "disabled";
  sortBy?: "nextRunAtMs" | "updatedAtMs" | "name";
  sortDir?: "asc" | "desc";
};

export type DeckGoCronRunsParams = {
  limit?: number;
  offset?: number;
  statuses?: DeckGoCronRunEntry["status"][];
  sortDir?: "asc" | "desc";
};

export type DeckGoCronRunParams = {
  mode?: "due" | "force";
};
```

## Mock fixture notes

The bundled mock Gateway provides:

- `cron.status`, `cron.jobs.list`, `cron.jobs.create`, `cron.jobs.update`,
  `cron.jobs.delete`, `cron.jobs.run`, `cron.runs.list` (all typed).

For L1 visual E2E:

- Seed 9+ jobs spanning 3 schedule kinds (cron / every / at).
- Seed run history with all 3 statuses (ok / error / skipped).
- Mock allows immediate creation/edit/delete; production has server-side
  validation of cron expressions + agent existence.

This is mock visual coverage only. It does not prove real OpenClaw cron
scheduler semantics.

## BFF projections (flagged)

The KPI strip (Runs 1h / Errors 1h) is computed client-side from the
`runs` array in the prototype. **Production target**: contract should
publish a typed `cron.runs.summary(window)` RPC returning the aggregated
stats so the KPIs are not client-computed.

The global next-run countdown in topbar comes from `DeckGoCronStatus.nextRunAtMs`,
which IS part of the contract.

## Stack decisions punted

- **Cron expression validator** — prototype trusts operator input. Production
  needs `cron-parser` (or equivalent) to validate + show "next 5 fires"
  preview. Not in current contract.
- **Schedule preview RPC** — per above; consider `cron.preview(expr)` typed
  RPC returning typed next-N-fires for offline-capable preview.
- **Live history stream** — prototype polls runs. Production may want
  `cron.runs.subscribe` stream so new run entries push without polling.
- **Bulk operations** — bulk enable/disable/delete is a real ops need; not
  in current contract. Consider a future typed bulk endpoint accepting an array
  of `{ id, action }`.
- **Optimistic concurrency** — `PATCH /api/cron/:id` doesn't take a
  version/etag. Two operators editing simultaneously: last-write-wins.

## Open contract assumptions

These match README §"Open questions for follow-up":

1. **Cron expression preview** — should the contract publish a typed
   `cron.preview(expr)` RPC returning next-N-fires?
2. **Pagination shape** — `DeckGoCronRunsParams` has limit/offset. Should
   it also support cursor-based for infinite-scroll history?
3. **Stagger semantics** — `staggerMs` on `every` schedules: random jitter
   or fixed offset? Contract is silent.
4. **Run-now modes** — `due` vs `force`: does force override
   currently-running instance? Contract doesn't specify isolation.
5. **Job-history relationship** — should there be a `cron.history.subscribe`
   stream so the UI can push new run entries without polling?

## Known uncertainty

- Real Gateway `cron.runs.list` ordering not yet audited; prototype assumes
  desc by `ts`.
- Upstream `payload.kind` is a closed string union; contract widens to
  open with `[key: string]: unknown` for forwards-compat. Frontend should
  treat unknown payload kinds as `unknown` rather than misrendering.
- `delivery` field semantics differ per payload kind — contract leaves
  this `unknown`. Frontend renders raw JSON only.

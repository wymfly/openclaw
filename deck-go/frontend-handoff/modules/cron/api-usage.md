# Cron API Usage

## Endpoint Chain

| UI need                  | Frontend wrapper                                       | BFF endpoint                                       | Gateway method |
| ------------------------ | ------------------------------------------------------ | -------------------------------------------------- | -------------- |
| Scheduler job inventory  | `fetchCronJobs({ includeDisabled: true })`             | `GET /api/cron?includeDisabled=true`               | `cron.list`    |
| Scheduler status         | `fetchCronStatus()`                                    | `GET /api/cron/status`                             | `cron.status`  |
| Selected job run history | `fetchCronRuns(jobId, { limit: 20, sortDir: "desc" })` | `GET /api/cron/{jobId}/runs?limit=20&sortDir=desc` | `cron.runs`    |
| Create job               | `createCronJob(input)`                                 | `POST /api/cron`                                   | `cron.add`     |
| Update job               | `updateCronJob(jobId, input)`                          | `PATCH /api/cron/{jobId}`                          | `cron.update`  |
| Manual run               | `runCronJob(jobId, { mode: "force" })`                 | `POST /api/cron/{jobId}/run`                       | `cron.run`     |
| Delete job               | `deleteCronJob(jobId)`                                 | `DELETE /api/cron/{jobId}`                         | `cron.remove`  |

Browser code must not call Gateway directly. The Go BFF adapts query params and mutation bodies to the typed Gateway client.

## DTO Shapes Used

```ts
type DeckGoCronSchedule = {
  kind: "at" | "every" | "cron";
  at?: string;
  everyMs?: number;
  anchorMs?: number;
  expr?: string;
  tz?: string;
  staggerMs?: number;
};

type DeckGoCronJob = {
  id: string;
  name: string;
  schedule: DeckGoCronSchedule;
  sessionTarget?: string;
  wakeMode?: string;
  payload: { kind: "systemEvent" | "agentTurn"; [key: string]: unknown };
  delivery?: unknown;
  failureAlert?: boolean;
  agentId?: string;
  description?: string;
  enabled: boolean;
  deleteAfterRun?: boolean;
  nextRunAtMs?: number;
  updatedAtMs?: number;
  createdAtMs?: number;
};

type DeckGoCronRunEntry = {
  id: string;
  jobId: string;
  status: "ok" | "error" | "skipped";
  ts: number;
  runAtMs?: number;
  durationMs?: number;
  delivery?: unknown;
  error?: string;
};

type DeckGoCronStatus = {
  running: boolean;
  jobCount?: number;
  nextRunAtMs?: number;
};
```

## Fields Used

### Job catalog

- `id`
- `name`
- `schedule.kind`, `schedule.expr`, `schedule.everyMs`, `schedule.at`
- `enabled`
- `nextRunAtMs`
- `description`

### Job form

- `name`
- schedule kind/value
- `sessionTarget`
- `wakeMode`
- `payload.kind`
- payload text/message value
- `agentId`
- `description`
- `enabled`

### Selected detail

- selected `DeckGoCronJob`
- selected run entries from `DeckGoCronRunsResponse.entries`
- scheduler heartbeat fields from `DeckGoCronStatus`
- action result payload from create/update/run/delete wrapper response

## Mock Visual Boundary

The bundled mock Gateway must implement contract-shaped `cron.list`, `cron.status`, `cron.runs`, `cron.add`, `cron.update`, `cron.run`, and `cron.remove` for visual E2E. Evidence from this package is mock visual coverage, not real Gateway/LLM coverage and not proof of full upstream scheduler semantics.

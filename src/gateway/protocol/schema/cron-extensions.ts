import { Type } from "@sinclair/typebox";
import { CronJobSchema, CronRunLogEntrySchema } from "./cron.js";

// ---------------------------------------------------------------------------
// Result schemas for cron.* methods
// ---------------------------------------------------------------------------

/** Result of `cron.list` — paginated list of cron jobs. */
export const CronListResultSchema = Type.Object(
  {
    jobs: Type.Array(CronJobSchema),
    total: Type.Number(),
    offset: Type.Number(),
    limit: Type.Number(),
    hasMore: Type.Boolean(),
    nextOffset: Type.Union([Type.Number(), Type.Null()]),
  },
  { additionalProperties: false },
);

/** Result of `cron.status` — scheduler health snapshot. */
export const CronStatusResultSchema = Type.Object(
  {
    enabled: Type.Boolean(),
    storePath: Type.String(),
    jobs: Type.Number(),
    nextWakeAtMs: Type.Union([Type.Integer({ minimum: 0 }), Type.Null()]),
  },
  { additionalProperties: false },
);

/** Result of `cron.add` — the newly created cron job. */
export const CronAddResultSchema = CronJobSchema;

/** Result of `cron.update` — the updated cron job. */
export const CronUpdateResultSchema = CronJobSchema;

/** Result of `cron.remove` — removal confirmation. */
export const CronRemoveResultSchema = Type.Object(
  {
    ok: Type.Boolean(),
    removed: Type.Boolean(),
  },
  { additionalProperties: false },
);

/**
 * Result of `cron.run` (via enqueueRun) — either enqueued, skipped, or failed.
 * The handler returns one of several discriminated shapes; this schema covers
 * the union with optional fields.
 */
export const CronRunResultSchema = Type.Object(
  {
    ok: Type.Boolean(),
    enqueued: Type.Optional(Type.Boolean()),
    runId: Type.Optional(Type.String()),
    ran: Type.Optional(Type.Boolean()),
    reason: Type.Optional(
      Type.Union([
        Type.Literal("already-running"),
        Type.Literal("not-due"),
        Type.Literal("invalid-spec"),
      ]),
    ),
  },
  { additionalProperties: false },
);

/** Result of `cron.runs` — paginated run log entries. */
export const CronRunsResultSchema = Type.Object(
  {
    entries: Type.Array(CronRunLogEntrySchema),
    total: Type.Number(),
    offset: Type.Number(),
    limit: Type.Number(),
    hasMore: Type.Boolean(),
    nextOffset: Type.Union([Type.Number(), Type.Null()]),
  },
  { additionalProperties: false },
);

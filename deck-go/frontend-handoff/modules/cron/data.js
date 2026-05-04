// Cron fixture — DeckGoCronJob + DeckGoCronSchedule + DeckGoCronRunEntry +
// DeckGoCronStatus shapes from deck-api.contract.ts. KPI strip is BFF
// projection over runs aggregate.

const NOW = Date.now();
const MIN = 60_000;
const HR = 60 * MIN;
const DAY = 24 * HR;

// -- Cron status -----------------------------------------------------------

const CRON_STATUS = {
  running: true,
  jobCount: 9,
  nextRunAtMs: NOW + 38 * 1000,
};

// -- Jobs ------------------------------------------------------------------

const CRON_JOBS = [
  {
    id: "job-daily-rollup",
    name: "Daily rollup",
    description: "Aggregates per-channel deliveries and writes to usage table",
    schedule: { kind: "cron", expr: "0 6 * * *", tz: "UTC" },
    sessionTarget: "session-rollup",
    wakeMode: "background",
    payload: { kind: "agentTurn", prompt: "rollup yesterday's metrics" },
    agentId: "agent-orca",
    enabled: true,
    failureAlert: true,
    nextRunAtMs: NOW + 8 * HR,
    updatedAtMs: NOW - 4 * DAY,
    createdAtMs: NOW - 18 * DAY,
  },
  {
    id: "job-health-probe",
    name: "Health probe",
    description: "Pings external endpoints and emits alert on 3 consecutive failures",
    schedule: { kind: "every", everyMs: 5 * MIN },
    sessionTarget: "session-probe",
    wakeMode: "wake",
    payload: { kind: "systemEvent", topic: "health.probe.tick" },
    enabled: true,
    failureAlert: true,
    nextRunAtMs: NOW + 38 * 1000,
    updatedAtMs: NOW - 12 * HR,
    createdAtMs: NOW - 32 * DAY,
  },
  {
    id: "job-weekly-digest",
    name: "Weekly digest",
    description: "Composes the weekly ops digest and posts to channels",
    schedule: { kind: "cron", expr: "0 9 * * 1", tz: "America/New_York" },
    sessionTarget: "session-digest",
    wakeMode: "background",
    payload: { kind: "agentTurn", prompt: "compose weekly digest" },
    agentId: "agent-helix",
    enabled: true,
    failureAlert: false,
    nextRunAtMs: NOW + 3 * DAY + 4 * HR,
    updatedAtMs: NOW - 2 * DAY,
    createdAtMs: NOW - 60 * DAY,
  },
  {
    id: "job-stale-session-sweep",
    name: "Stale session sweep",
    description: "Closes sessions idle for >24h",
    schedule: { kind: "every", everyMs: 30 * MIN, staggerMs: 60_000 },
    sessionTarget: "session-sweep",
    wakeMode: "background",
    payload: { kind: "systemEvent", topic: "session.sweep" },
    enabled: false,
    failureAlert: false,
    nextRunAtMs: null,
    updatedAtMs: NOW - 6 * DAY,
    createdAtMs: NOW - 22 * DAY,
  },
  {
    id: "job-link-renew",
    name: "Channel link renew",
    description: "Refreshes WeCom OAuth tokens before expiry",
    schedule: { kind: "every", everyMs: 4 * HR },
    sessionTarget: "session-link",
    wakeMode: "wake",
    payload: { kind: "systemEvent", topic: "channel.link.renew" },
    enabled: true,
    failureAlert: true,
    nextRunAtMs: NOW + 2 * HR + 14 * MIN,
    updatedAtMs: NOW - 1 * DAY,
    createdAtMs: NOW - 14 * DAY,
  },
  {
    id: "job-backup",
    name: "Snapshot backup",
    description: "Backs up the deck-go state JSON to remote object store",
    schedule: { kind: "cron", expr: "0 3 * * *", tz: "UTC" },
    sessionTarget: "session-backup",
    wakeMode: "background",
    payload: { kind: "systemEvent", topic: "backup.snapshot" },
    enabled: true,
    failureAlert: true,
    nextRunAtMs: NOW + 5 * HR + 12 * MIN,
    updatedAtMs: NOW - 9 * HR,
    createdAtMs: NOW - 28 * DAY,
  },
  {
    id: "job-onboarding-followup",
    name: "Onboarding follow-up",
    description: "One-shot at 9 AM tomorrow to ping the new operator",
    schedule: { kind: "at", at: new Date(NOW + 16 * HR).toISOString() },
    sessionTarget: "session-onboarding",
    wakeMode: "wake",
    payload: { kind: "agentTurn", prompt: "send onboarding nudge" },
    agentId: "agent-orca",
    enabled: true,
    failureAlert: false,
    deleteAfterRun: true,
    nextRunAtMs: NOW + 16 * HR,
    updatedAtMs: NOW - 30 * MIN,
    createdAtMs: NOW - 30 * MIN,
  },
  {
    id: "job-quota-recheck",
    name: "Quota recheck",
    description: "Verifies provider quota windows and demotes near-exhausted",
    schedule: { kind: "every", everyMs: 15 * MIN },
    sessionTarget: "session-quota",
    wakeMode: "background",
    payload: { kind: "systemEvent", topic: "quota.recheck" },
    enabled: true,
    failureAlert: true,
    nextRunAtMs: NOW + 9 * MIN,
    updatedAtMs: NOW - 4 * HR,
    createdAtMs: NOW - 17 * DAY,
  },
  {
    id: "job-flaky-disabled",
    name: "Old probe (flaky)",
    description: "Disabled — was triggering false alerts",
    schedule: { kind: "every", everyMs: 60 * MIN },
    sessionTarget: "session-legacy",
    wakeMode: "wake",
    payload: { kind: "systemEvent", topic: "legacy.probe" },
    enabled: false,
    failureAlert: false,
    nextRunAtMs: null,
    updatedAtMs: NOW - 21 * DAY,
    createdAtMs: NOW - 90 * DAY,
  },
];

// -- Run entries (last 30 runs across all jobs) ----------------------------

function makeRun(jobId, status, minutesAgo, durationMs, error) {
  return {
    id: `run-${jobId}-${minutesAgo}`,
    jobId,
    status,
    ts: NOW - minutesAgo * MIN,
    runAtMs: NOW - minutesAgo * MIN - durationMs,
    durationMs,
    delivery: status === "ok" ? { dispatched: 1 } : null,
    error: error || null,
  };
}

const CRON_RUNS = [
  makeRun("job-health-probe", "ok", 5, 380),
  makeRun("job-health-probe", "ok", 10, 410),
  makeRun("job-health-probe", "ok", 15, 392),
  makeRun(
    "job-health-probe",
    "error",
    20,
    1820,
    "fetch failed: ETIMEDOUT https://api.example.com/health",
  ),
  makeRun("job-health-probe", "ok", 25, 388),
  makeRun("job-quota-recheck", "ok", 6, 612),
  makeRun("job-quota-recheck", "ok", 21, 587),
  makeRun("job-quota-recheck", "skipped", 36, 14, "skipped: no provider quota changes"),
  makeRun("job-link-renew", "ok", 12, 921),
  makeRun("job-link-renew", "ok", 252, 855),
  makeRun("job-link-renew", "error", 492, 4_320, "wecom oauth refresh: 401 invalid_token"),
  makeRun("job-stale-session-sweep", "ok", 18, 1402),
  makeRun("job-stale-session-sweep", "ok", 48, 1198),
  makeRun("job-daily-rollup", "ok", 480, 32_412),
  makeRun("job-daily-rollup", "ok", 1920, 31_180),
  makeRun(
    "job-daily-rollup",
    "error",
    3360,
    8_240,
    "rollup query timeout: read tcp 10.0.0.4:5432 i/o timeout",
  ),
  makeRun("job-weekly-digest", "ok", 4320, 67_204),
  makeRun("job-backup", "ok", 540, 22_010),
  makeRun("job-backup", "ok", 1980, 21_544),
  makeRun("job-backup", "error", 3420, 4_010, "s3 upload failed: NoSuchBucket"),
  makeRun("job-flaky-disabled", "skipped", 60, 8, "job disabled"),
  makeRun("job-flaky-disabled", "skipped", 120, 9, "job disabled"),
  makeRun("job-onboarding-followup", "ok", 1440, 8_240),
  makeRun("job-quota-recheck", "ok", 51, 590),
  makeRun("job-health-probe", "ok", 30, 412),
  makeRun("job-health-probe", "ok", 35, 397),
];

// -- KPI stats (BFF projection) --------------------------------------------

const KPI_STATS = {
  scheduler: CRON_STATUS.running ? "running" : "stopped",
  totalJobs: CRON_JOBS.length,
  enabledJobs: CRON_JOBS.filter((j) => j.enabled).length,
  runs1h: CRON_RUNS.filter((r) => NOW - r.ts < HR).length,
  errorRate1h: 0.12,
  nextRun: CRON_STATUS.nextRunAtMs,
};

const BOOTSTRAP = { ok: true, runtimeVersion: "0.5.0" };

Object.assign(window, {
  CRON_STATUS,
  CRON_JOBS,
  CRON_RUNS,
  KPI_STATS,
  BOOTSTRAP,
});

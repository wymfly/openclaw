# Cron Components

## Component Tree

```text
CronPanel
  CronWorkbench
    SchedulerColumn
      SchedulerHeader
      SchedulerMetrics
      JobCatalog
        JobCatalogRow
      JobFormPanel
        ScheduleTemplateStrip
        ScheduleFields
        PayloadFields
        FormActionBar
      PrimaryActionBar
    DetailColumn
      DetailTabStrip
      SelectedJobHero
      SelectedJobFacts
      ConfigurationPayload
      RunHistoryPanel
        RunHistoryRow
      HeartbeatPanel
      LastActionDetail
```

## Module-Local Molecules

### Scheduler header

- Shows title, contract description, scheduler readiness, running state, total jobs, enabled jobs, and next execution.
- Reuses prior workbench header rhythm but keeps scheduler-specific labels local.

### Scheduler metric tile

- Compact tile for total jobs, enabled jobs, and next execution.
- Repeats prior metric tile molecules but remains local until a dedicated KPI/card proposal defines a shared API.

### Job catalog row

- Button row with job name, schedule summary, enabled/disabled state, next run, and selected state.
- Long job names and schedules wrap inside stable constrained regions.

### Job form panel

- Contains template buttons, typed schedule inputs, session/wake selectors, payload type/value, agent id, description, enabled toggle, and create/save actions.
- Preserves the current `CronDraft` model and wrapper payload shape.

### Selected job hero

- Shows selected job name, description, status, schedule summary, agent id, and next run.
- Keeps selected identity stable while tabs change.

### Run history row

- Shows start time, duration, status, and optional error/delivery evidence.
- Stays module-local because Cron run history has scheduler-specific semantics.

### Heartbeat panel

- Shows scheduler heartbeat availability and next execution countdown/evidence.
- It is read-only in this module pass.

### Last action detail

- Uses raw JSON disclosure for create/update/run/delete responses.
- The raw payload is evidence, not primary navigation.

## Props / Data Boundaries

The production implementation may keep helper components under `src/components/panels/cron/`. It should not widen public APIs. All data remains internal to `CronPanel` and is sourced from existing `src/api.ts` wrappers.

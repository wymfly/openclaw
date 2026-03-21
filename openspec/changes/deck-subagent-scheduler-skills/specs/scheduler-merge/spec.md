## MODIFIED Requirements

### Requirement: CronPanel renamed to SchedulerPanel with Heartbeat Tab

The existing CronPanel SHALL be renamed to SchedulerPanel and gain a new "Heartbeat" tab alongside the existing Cron job management.

#### Scenario: Panel displays with two sections

- **WHEN** user navigates to the Scheduler panel
- **THEN** the panel shows two top-level tabs: "Cron Jobs" (existing) and "Heartbeat"
- **AND** the NavRail entry shows "Scheduler" instead of "Cron"

#### Scenario: Cron Jobs tab preserves existing behavior

- **WHEN** user selects the "Cron Jobs" tab
- **THEN** all existing functionality (JobList, JobForm, RunHistory, RunNowButton) works identically to the current CronPanel

## ADDED Requirements

### Requirement: Heartbeat configuration UI

The Heartbeat tab SHALL display and edit heartbeat settings including interval, active hours, and delivery target.

#### Scenario: Display global heartbeat config

- **WHEN** user navigates to the Heartbeat tab
- **THEN** system displays current heartbeat configuration: enabled toggle, interval (minutes), active hours (time range picker), delivery target (agent selector), and message template

#### Scenario: Edit heartbeat interval

- **WHEN** user changes the heartbeat interval from 30 to 60 minutes and saves
- **THEN** system applies the change via `config.patch` to `agents.defaults.heartbeat.interval` and shows success toast

#### Scenario: Set active hours

- **WHEN** user sets active hours to 09:00-18:00 using the time range picker
- **THEN** system saves `activeHours: { start: "09:00", end: "18:00" }` via `config.patch`
- **AND** heartbeat only triggers within this window

#### Scenario: Select delivery target

- **WHEN** user selects a specific agent as the heartbeat target
- **THEN** system saves the agent ID as the delivery target; default is the default agent

#### Scenario: Disable heartbeat

- **WHEN** user toggles heartbeat off and saves
- **THEN** system sets `heartbeat.enabled: false` via `config.patch` and shows confirmation

### Requirement: Per-agent heartbeat override

Below the global config, a table SHALL show per-agent heartbeat overrides with the ability to add/edit/remove overrides.

#### Scenario: Add per-agent override

- **WHEN** user clicks "Add Override" and selects an agent with custom interval 15 minutes
- **THEN** system saves the override to `agents.<agentId>.heartbeat.interval` via `config.patch`

#### Scenario: Remove per-agent override

- **WHEN** user clicks "Remove" on a per-agent override and confirms
- **THEN** system removes the override; the agent falls back to global defaults

### Requirement: Next-execution countdown display

Both Cron Jobs and Heartbeat SHALL display a countdown to the next scheduled execution.

#### Scenario: Cron job countdown

- **WHEN** a cron job is enabled and has a valid schedule
- **THEN** the job card shows "Next run: 2h 15m" (live countdown, updates every second when < 1 minute, every minute otherwise)

#### Scenario: Heartbeat countdown

- **WHEN** heartbeat is enabled and within active hours
- **THEN** the Heartbeat tab header shows "Next heartbeat: 12m 30s" with live countdown

#### Scenario: Outside active hours

- **WHEN** current time is outside configured active hours
- **THEN** the countdown shows "Next heartbeat: tomorrow 09:00" (next active window start)

#### Scenario: Disabled schedule

- **WHEN** a cron job or heartbeat is disabled
- **THEN** the countdown area shows "已停用" with a muted style

## ADDED Requirements

### Requirement: Cron Job CRUD

The cron management panel SHALL support creating, reading, updating, and deleting scheduled tasks via Gateway RPCs `cron.add`, `cron.list`, `cron.update`, and `cron.remove`.

#### Scenario: List scheduled jobs

- **WHEN** the user navigates to the Cron panel
- **THEN** the panel SHALL call `cron.list` and display all scheduled jobs with their name, cron expression, next run time, and enabled status

#### Scenario: Create a new job

- **WHEN** the user fills in the job creation form with a name, cron expression, and command, then submits
- **THEN** the panel SHALL call `cron.add` and the new job SHALL appear in the list upon success

#### Scenario: Delete a job

- **WHEN** the user confirms deletion of a scheduled job
- **THEN** the panel SHALL call `cron.remove` and remove the job from the list

### Requirement: Schedule Templates

The panel SHALL provide pre-built schedule templates (every 5 minutes, hourly, daily, weekly) that populate the cron expression field.

#### Scenario: Apply schedule template

- **WHEN** the user selects the "hourly" template
- **THEN** the cron expression field SHALL be populated with `0 * * * *` and the user can further customize before saving

### Requirement: Run History

The panel SHALL display run history for each job showing execution time, duration, and outcome via the `cron.runs` RPC.

#### Scenario: View run history

- **WHEN** the user expands a job's run history section
- **THEN** the panel SHALL call `cron.runs` and display a list of past executions with start time, duration, and success/failure status

### Requirement: Manual Trigger

The panel SHALL allow manually triggering a scheduled job via the `cron.run` RPC.

#### Scenario: Manual job execution

- **WHEN** the user clicks "Run Now" on a scheduled job
- **THEN** the panel SHALL call `cron.run` for that job and display a confirmation when execution starts

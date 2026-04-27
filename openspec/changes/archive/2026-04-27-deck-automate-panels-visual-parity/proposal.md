## Why

The Automate group is visually under-migrated. Old Deck had separate workflow UIs for scheduling, cron jobs, webhooks, approvals, and skills, but the current Vite implementation mostly collapses each area into one panel file.

This group controls execution automation and policy-sensitive approvals. Visual parity must preserve the old interaction model, not just expose enough data to pass smoke traversal.

## What Changes

- Restore old Deck desktop visual and interaction structure for Cron/Scheduler, Webhooks, Approvals, and Skills.
- Restore old job forms, job lists, run history, run-now controls, countdown/heartbeat config, webhook forms, delivery history, approval policy editors, pending/plugin lists, path allowlists, skill hub/info/config/matrix tabs, and install dialog.
- Wire all Automate group visible copy through EN/ZH i18n.
- Fix or classify Go backend/API/projection gaps discovered while restoring old Node+Next automation workflows.
- Validate each Automate panel with old authority files, current target files, screenshots, interaction checks, and backend gap notes.

## Capabilities

### New Capabilities

- `deck-automate-panel-parity`: Defines old Deck visual, interaction, i18n, and backend-gap parity requirements for Cron/Scheduler, Webhooks, Approvals, and Skills.

### Modified Capabilities

- None.

## Impact

- Reference files:
  - `dashboard/src/components/panels/cron/**/*`
  - `dashboard/src/components/panels/scheduler/**/*`
  - `dashboard/src/components/panels/webhooks/**/*`
  - `dashboard/src/components/panels/approvals/**/*`
  - `dashboard/src/components/panels/skills/**/*`
- Vite target files:
  - `deck-go/frontend/src/components/panels/cron/**/*`
  - `deck-go/frontend/src/components/panels/webhooks/**/*`
  - `deck-go/frontend/src/components/panels/approvals/**/*`
  - `deck-go/frontend/src/components/panels/skills/**/*`
  - `deck-go/**/*` backend/API files needed to close documented Automate panel parity gaps
- Evidence:
  - Old Cron has job form/list/history/run-now components; Vite Cron has one panel file.
  - Old Scheduler has heartbeat config, job form/list, countdown, run history, and run-now components; Vite has no separate scheduler panel tree.
  - Old Approvals has pending list, plugin list, policy editor, path allowlist, and SSE hook; Vite Approvals has one panel file.
  - Old Skills has hub/info/config/matrix/list/install dialog components; Vite Skills has one panel file.

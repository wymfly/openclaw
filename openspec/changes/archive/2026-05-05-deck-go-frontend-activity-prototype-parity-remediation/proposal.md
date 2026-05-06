## Why

The current `frontend-new` Activity panel still renders the older activity-plus-monitor diagnostics workspace, while the active handoff prototype at `deck-go/frontend-handoff/modules/activity/prototype.html` is a flat unified feed with KPI strip, filter segments, and an event detail dialog. That structural drift makes the previous mock screenshots insufficient as high-fidelity evidence and leaves the real E2E coverage below the strengthened product standard.

## What Changes

- Reconcile the active Activity prototype with Gateway/deck-go contract truth:
  - Activity page visual truth is the flat unified feed and `EventDetailDialog`.
  - Browser transport remains Deck BFF only.
  - Existing `/api/monitor/*` read models remain supported for other observability surfaces, but they are not the primary Activity page UI in this remediation.
- Rewrite or simplify `frontend-new/src/components/panels/activity/ActivityPanel.tsx` and module CSS to match the active prototype:
  - KPI strip;
  - search, family, severity, and time-range segmented filters;
  - hour-bucket grouped feed rows;
  - event detail modal with copyable raw JSON;
  - loading, error, and empty states.
- Preserve deterministic Activity contract behavior:
  - `GET /api/activity`;
  - `activity.event` SSE merge and duplicate suppression;
  - unknown event types render safely as muted/generic events.
- Update focused tests and mock fixtures where needed so mock functional coverage exercises contract-shaped activity events rather than the obsolete monitor layout.
- Strengthen real Gateway E2E for Activity:
  - navigate from the Deck shell into Activity;
  - cover dark/English and light/Chinese variants;
  - exercise filter segments, search, row selection, dialog copy/close, refresh, and empty state;
  - seed representative real activity data through a safe run-scoped real chat/session attempt when available, with bounded circuit breaker and evidence if the LLM/provider environment blocks seeding;
  - record unexpected console, page, BFF API, and direct Gateway browser access evidence.
- Produce prototype-vs-current contact sheet and structured verdict for Activity, with any remaining differences recorded as accepted exceptions.

## Capabilities

### New Capabilities

- `frontend-activity-prototype-parity-remediation`: Covers Activity active-prototype alignment, BFF-only activity contract use, mock parity evidence, strengthened real Gateway evidence, and accepted-exception handling.

### Modified Capabilities

- `frontend-prototype-parity-remediation`: Marks the Activity row complete only after this child proposal passes mock parity, strengthened real E2E or bounded handoff, and archive validation.

## Impact

- OpenSpec:
  - `openspec/changes/deck-go-frontend-activity-prototype-parity-remediation/`;
  - `openspec/changes/deck-go-frontend-prototype-parity-remediation/tasks.md`;
  - `deck-go/docs/project/frontend-prototype-remediation-matrix.md`.
- Frontend:
  - `deck-go/frontend-new/src/components/panels/activity/`;
  - `deck-go/frontend-new/src/i18n/en.json`;
  - `deck-go/frontend-new/src/i18n/zh.json`.
- Handoff/docs:
  - `deck-go/frontend-handoff/modules/activity/implementation-notes.md`.
- Tests and evidence:
  - `deck-go/frontend-new/src/components/panels/activity/ActivityPanel.test.tsx`;
  - `deck-go/test/e2e/activity-visual.spec.ts`;
  - `deck-go/test/e2e/activity-real-gateway.spec.ts`;
  - prototype parity report artifacts under `deck-go/.local/`.
- Backend/contracts:
  - no expected contract source change unless exploration finds deterministic DTO or BFF drift.

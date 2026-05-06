# approvals — interactions (v2)

> Contract note: this file describes intended prototype interactions. Production
> implementation only sends current Gateway-supported decision envelopes
> (`id`, hyphenated `decision`) and treats reason capture, bulk actions, and
> audit projections as follow-up contract work.

## Pointer

- **Topbar Refresh click** → spinner animates 720ms; production refetches
  pending exec + plugin + policy.
- **Topbar Policy click** → opens PolicyEditor modal.
- **Queue row click** → selects entry; right pane shows detail.
- **Queue row Enter / Space** → identical to click (focused row).
- **Kind filter button click** → updates `kindFilter`; queue rows refilter.
- **Search input change** → live filter on command + subtitle + id.
- **Detail tab click** → switches active tab. No refetch.
- **DecisionBar Deny click** → enters `submitting` phase; ~480ms; appends
  decision to recent strip; clears selection or moves to next.
- **DecisionBar Allow once click** → identical to Deny but with `allow_once`.
- **DecisionBar Allow always click** → identical to Deny but with `allow_always`.
  Production: also appends command to allowlist.
- **DecisionBar reason input** → typed text recorded in audit on submit.
- **PolicyEditor PolicyField select change** → updates draft.
- **PolicyEditor agent remove click** → removes agent key from draft.
- **PolicyEditor allowlist add click / Enter** → appends to draft allowlist.
- **PolicyEditor allowlist remove click** → removes path from draft.
- **PolicyEditor Save click** → enters `saving` phase; ~600ms; closes modal.
- **PolicyEditor Cancel / backdrop click** → closes modal without save.

## Keyboard

| Key                 | Context                                 | Behavior                                                                                       |
| ------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `Enter` / `Space`   | focused queue row                       | Select entry.                                                                                  |
| `Tab` / `Shift Tab` | within page                             | Cycle: filter seg → search → queue rows → detail tabs → reason → 3 actions → Refresh → Policy. |
| `Esc`               | PolicyEditor modal open                 | Close modal (except `saving` phase).                                                           |
| `Enter`             | PolicyEditor allowlist add input        | Add path (if non-empty).                                                                       |
| `Tab` / `Shift Tab` | within PolicyEditor modal               | Cycle through default fields → agent fields → allowlist controls → footer buttons.             |
| `A`                 | (production target) detail pane focused | Allow once.                                                                                    |
| `D`                 | (production target) detail pane focused | Deny.                                                                                          |
| `Shift+A`           | (production target) detail pane focused | Allow always.                                                                                  |

The PolicyEditor's `saving` phase is **non-cancellable** — Esc + backdrop
no-op while the simulated 600ms timer is in flight. Same for DecisionBar's
`submitting` phase (~480ms).

## Hover

- **Topbar KPI cells** — no hover (informational only).
- **Topbar Refresh button** — bg lifts; spinner animates while refreshing.
- **Topbar Policy button** — bg lifts.
- **Kind filter button** — bg lifts; active keeps accent inset shadow.
- **Search input** — no hover (focus only).
- **Queue row** — bg lifts; active keeps accent border + inset shadow.
- **Detail tab** — color shifts to fg-1; active keeps accent border.
- **DecisionBar Deny** — red tint bg.
- **DecisionBar Allow once** — green tint bg.
- **DecisionBar Allow always** — filtered brightness 1.1 (filled state).
- **PolicyEditor remove buttons** — bg lifts; hover red tint for destructive.
- **Recent decision row** — no hover (informational only).

## Density

`compact` (default):

- Topbar padding `18px 28px`.
- Main row gap `18px`; row padding `18px 20px`.
- Queue row padding `12px 14px`.
- Queue list width `360px`.

`cozy`:

- Topbar padding `22px 32px`.
- Main row gap `22px`; row padding `22px 24px`.
- Queue row padding `14px 16px`.
- Queue list width `400px`.

The Tweaks panel toggles between the two via `data-density` on the root.

## Empty / loading / error

| Scenario                                | UI                                                                                                       |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `pending = []` and `pluginPending = []` | Queue empty card "No pending approvals match." Detail empty card with shield icon.                       |
| Search filters all out                  | Empty card "No pending approvals match."                                                                 |
| `selectedId = null`                     | Detail pane shows shield icon + "Pick a pending approval from the queue."                                |
| `recentDecisions = []`                  | Strip head still shows; row grid empty.                                                                  |
| Decision phase = `submitting`           | All 3 action buttons + reason input disabled. Phase strip "Submitting decision…" with `role="status"`.   |
| Decision phase = `done`                 | Green check + "Decision recorded." for 600ms.                                                            |
| Policy phase = `saving`                 | Save + Cancel disabled. Foot phase strip "Saving policy…" with `role="status"`.                          |
| Stream disconnect (production)          | Topbar pill flips warn tone "Stream offline — Refresh to refetch."                                       |
| Bootstrap not ready                     | Subtitle shows "runtime v—".                                                                             |
| Countdown reaches 0                     | Pulsing red chip; production auto-removes entry on `approval.resolved` event with `decision: "expired"`. |

## Focus

- After tab click → focus stays on the tab.
- After Refresh → focus stays on Refresh.
- After Policy open → focus jumps to first PolicyField select (production target — focus trap on mount).
- After Policy close → focus returns to the Policy trigger.
- After queue row click → focus stays on the row.
- After decision recorded → focus moves to next queue row (production target).
- After PolicyEditor save → focus returns to Policy trigger.

## A11y semantics

- **Topbar**: KPI cells have implicit role from elements; no overrides.
- **KPI cells** with warn/err tone: production should add `aria-label`
  describing the value + tone.
- **QueueList**:
  - List wrapped in `role="region" aria-label="Pending approvals"`.
  - Filter seg uses `role="tablist"` + per-button `role="tab"` + `aria-selected`.
  - Per-row uses `role="listitem"` (rendered inside `role="list"`).
- **ApprovalDetail**:
  - Tab strip uses `role="tablist"` + `role="tab"` + `aria-selected`.
- **DecisionBar**:
  - Phase strip running uses `role="status"`.
  - Phase strip done is decorative (visual only).
  - Reason input has implicit role from `<input type="text">`.
- **PolicyEditor modal**:
  - `role="dialog" aria-modal="true" aria-label="Approval policy editor"`.
  - Close button has `aria-label="Close policy editor"`.
  - Phase strip saving uses `role="status"`.
- **CountdownTimer**: production should expose remaining time via
  `aria-live="polite"` on a hidden span (current visual text doesn't suffice).
- **Recent decisions**: rows are decorative; production should pair the
  decision badge text with `aria-label` for screen readers.

## Tweaks-driven exploration

Design-time only. Tweaks panel exposes:

- `theme` ∈ `dark | light`
- `density` ∈ `compact | cozy`

Production translation drops the panel entirely.

## Decision-critical safety rails

This is a **mutation-heavy** panel. Every action records audit:

- Decisions: `POST /api/approvals` (or `/plugins`) emits `approval.resolved` event.
- Policy save: `PUT /api/approvals/policy` mutates the file + bumps hash.
- Allowlist add / remove: subset of policy save.

No silent side effects: every change is visible in either the queue
disappearing (decided) or the recent-decisions strip (newly resolved).

The 60-second countdown is a soft guarantee — server-side `expiresAtMs`
is authoritative. UI displays remaining time computed from local clock.

## Cross-section coupling

- **Approvals ↔ Activity** (US-006): every decision emits an `approval.resolved`
  event that the activity panel surfaces in its full audit feed.
- **Approvals ↔ Settings** (US-011): the policy file is also editable in
  settings panel — both edit the same `approvals.json`. Policy hash is
  the optimistic-concurrency token.
- **Approvals ↔ Agents** (`agents` panel): per-agent overrides reference
  agent IDs from the agents panel; production should validate agent
  existence on save.
- **Approvals ↔ Plugins** (US-003): plugin approvals reference plugin IDs
  from the plugins panel; pluginName is the display field.
- **Approvals ↔ Gateway** (US-015): describe lists `exec.approval.*` and
  `plugin.approval.*` methods; gateway is the canonical source for
  approval RPC truth.

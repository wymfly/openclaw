# approvals — states (v2)

## Top-level state

```ts
{
  // Server-side snapshots
  pendingExec: DeckGoPendingApproval[],
  pendingPlugin: DeckGoPluginApprovalEntry[],
  recentDecisions: Array<{
    id: string;
    kind: "exec" | "plugin";
    decision: "allow_once" | "allow_always" | "deny" | "expired";
    actor: string;
    command: string;
    agentId: string | null;
    decidedAtMs: number;
    reason: string | null;
  }>,
  policy: DeckGoApprovalPolicyResponse,

  // UI state
  selectedId: string | null,
  kindFilter: "all" | "exec" | "plugin",
  query: string,
  policyOpen: boolean,
  refreshing: boolean,
}
```

DecisionBar-internal state:

```ts
{
  reason: string,
  phase: "idle" | "submitting" | "done",
}
```

PolicyEditor-internal state:

```ts
{
  draft: {
    defaults?: DeckGoApprovalPolicyDefaults;
    agents?: Record<string, DeckGoApprovalPolicyDefaults>;
    allowlist?: string[];
  },
  allowlistInput: string,
  phase: "idle" | "saving" | "done",
}
```

Tweaks-driven (design-time only):

```ts
{
  theme: "dark" | "light",
  density: "compact" | "cozy",
}
```

## Loading / Empty / Error states

| Scenario                                | UI                                                                                           |
| --------------------------------------- | -------------------------------------------------------------------------------------------- |
| Initial load (no fixture yet)           | (production target) skeleton queue + 5-cell KPI placeholders. Prototype always seeds.        |
| `pending = []` and `pluginPending = []` | Queue empty card "No pending approvals match." Detail empty card with shield icon.           |
| Search + filter clears all              | Empty card "No pending approvals match."                                                     |
| `selectedId = null`                     | Detail pane shows shield icon + "Pick a pending approval from the queue." + muted helper.    |
| Decision phase = `submitting`           | DecisionBar buttons disabled, phase strip shows "Submitting decision…" with `role="status"`. |
| Decision phase = `done`                 | Green check + "Decision recorded." for 600ms before queue updates.                           |
| Policy save phase = `saving`            | Modal foot shows "Saving policy…" with `role="status"`; Save + Cancel disabled.              |
| Policy save phase = `done`              | Green check + "Policy saved." for 600ms before modal closes.                                 |
| `recentDecisions = []`                  | Strip head still shows summary; row grid empty (no rows).                                    |
| Stream disconnect (production)          | (production target) topbar pill flips warn tone "Stream offline — Refresh to refetch."       |
| `policy.hash` missing                   | Subtitle shows `policy hash —`; non-fatal.                                                   |

## Countdown states

| Remaining time | Tone    | Visual                                                          |
| -------------- | ------- | --------------------------------------------------------------- |
| `> 30s`        | ok      | Green chip with clock icon.                                     |
| `≤ 30s`        | warn    | Amber chip with clock icon.                                     |
| `< 15s`        | danger  | Red chip with clock icon, **pulsing animation**.                |
| `0s`           | expired | Auto-deny callback fires (production); prototype just shows 0s. |

The CountdownTimer uses `setInterval(force, 500)` for half-second
granularity. On unmount the interval clears.

## Decision states

| Decision       | Visual                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------ |
| `allow_once`   | Soft green badge "allow once". Adds entry to recent-decisions strip.                                   |
| `allow_always` | Filled green badge "allow always". (Production: appends to allowlist via `PUT /api/approvals/policy`.) |
| `deny`         | Red badge "deny". (Production: emits audit entry but does not block future approvals.)                 |
| `expired`      | Amber badge "expired". (Production: emitted by server when `expiresAtMs` reached.)                     |
| `pending`      | Neutral badge (rarely shown — pending entries live in queue, not strip).                               |

## Queue filter states

| `kindFilter` | Behavior                                                   |
| ------------ | ---------------------------------------------------------- |
| `all`        | Show both exec + plugin pending entries, sorted by expiry. |
| `exec`       | Show only exec entries.                                    |
| `plugin`     | Show only plugin entries.                                  |

Search query (`query`):

- Empty → no filtering.
- Non-empty → case-insensitive match on `command || pluginName`, `agentId || requester`, and `id`.

## Selected entry states

| Selected         | Detail pane behavior                                           |
| ---------------- | -------------------------------------------------------------- |
| `null`           | Empty card with shield icon + helper text.                     |
| Exec entry       | 4 tabs (overview/argv/plan/activity); DecisionBar visible.     |
| Plugin entry     | 4 tabs (overview/scopes/source/activity); DecisionBar visible. |
| Selected expired | Auto-clears selection on next render (production target).      |

## Decision bar lifecycle

```
idle (reason editable, all 3 buttons enabled)
  ─[click Deny]──┐
  ─[click Allow once]──┐
  ─[click Allow always]┴─▶ submitting (~480ms)
                              ─▶ done (~600ms)
                                ─▶ idle (reason cleared, queue updated)
```

Notes:

- Submitting locks reason input + all 3 action buttons.
- On done, the entry is removed from `pendingExec` / `pendingPlugin` and a
  new entry prepended to `recentDecisions`.
- The next entry in the queue auto-selects (or `null` if queue empty).

## Policy editor lifecycle

```
opened (draft = clone of policy.file, phase: idle)
  ─[Cancel / backdrop / Esc]──▶ closed (no save)
  ─[Save policy]──▶ saving (~600ms)
                      ─▶ done (~600ms)
                        ─▶ closed (policy state updated with new hash)
```

Notes:

- Edits operate on a deep-clone draft so Cancel preserves original policy.
- Save replaces entire policy file (matches `PUT /api/approvals/policy` semantics).
- Adding to allowlist is incremental (push to draft array).
- Removing per-agent override deletes the agent key.

## A11y / focus rules

- Topbar Refresh: focus stays on Refresh after click; spinner animation.
- Topbar Policy: focus stays on button after click; modal opens; focus jumps
  to first form element (production target — focus trap on mount).
- Queue row click: focus stays on row.
- Detail tab click: focus stays on tab.
- DecisionBar: after decision recorded, focus moves to next-selected row's
  decision bar (production target).
- PolicyEditor close: focus returns to Policy trigger button.
- Modal: `role="dialog" aria-modal="true"`; close has `aria-label="Close policy editor"`.

## Boundary cases

- **Empty allowlist**: Allowlist section shows "0 paths" + add input only.
- **Allowlist max length**: Not enforced in prototype; production target may cap at 100 entries.
- **Per-agent override pointing to non-existent agent**: Still shown — the agent registry is separate.
- **Pending approval with `agentId` undefined**: Subtitle shows "—".
- **Plugin approval with `requestedScopes` empty**: Scopes tab shows empty list.
- **Reason input > 200 chars**: Not truncated in prototype; production target enforces server-side cap.

## Theme variants

- `data-theme="dark"` (default) — uses canonical `--ds-*` palette.
- `data-theme="light"` (Tweaks demo only) — overrides body via the
  `[data-theme="light"]` block.

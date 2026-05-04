# approvals — components (v2)

## Tree

```
ApprovalsApp                                      [app.jsx]
├─ Topbar (sticky)
│  ├─ brand block (eyebrow + title + policy hash + runtime version)
│  ├─ KPI strip (5 cells: Pending exec / Pending plugin / Resolved 1h / Denied 1h / Avg response)
│  └─ actions (Policy editor / Refresh)
├─ Main 2-pane                                    [app.jsx]
│  ├─ QueueList                                   [queue-list.jsx]
│  │  ├─ head (title + count badge)
│  │  ├─ filters (kind seg + search)
│  │  └─ rows × N
│  │     ├─ head (KindBadge + CountdownTimer)
│  │     ├─ CommandTag (truncated to 46 chars)
│  │     └─ meta (subtitle + relative age)
│  └─ ApprovalDetail                              [approval-detail.jsx]
│     ├─ hero (KindBadge + id + CountdownTimer + title + 4 meta cells)
│     ├─ tabs (exec: overview/argv/plan/activity ;
│     │       plugin: overview/scopes/source/activity)
│     ├─ tab body (DetailOverview / DetailArgv / DetailPlan /
│     │           DetailScopes / DetailSource / DetailActivity)
│     └─ DecisionBar
│        ├─ reason input
│        ├─ actions (Deny / Allow once / Allow always)
│        └─ phase strip (running | done)
├─ Recent decisions strip                         [app.jsx]
│  └─ row × 12 (DecisionBadge + KindBadge + CommandTag + actor + when + reason)
└─ PolicyEditor (modal)                           [policy-editor.jsx]
   ├─ defaults section (4 PolicyField selects)
   ├─ per-agent overrides section (agent rows × N)
   ├─ allowlist section (rows + add input)
   └─ foot (phase + Cancel + Save)
```

## Local molecules (in `icons.jsx`)

### KindBadge

`<KindBadge kind="exec" />` — color-coded per approval kind:

- `exec` → warn (amber) — exec approvals
- `plugin` → info (blue) — plugin approvals
- unknown → neutral

### DecisionBadge

`<DecisionBadge decision="allow_once" />` — color-coded per decision:

- `allow_once` → ok (soft green)
- `allow_always` → ok-strong (filled green)
- `deny` → err (red)
- `expired` → warn (amber)
- `pending` → neutral

Strong promotion candidate — any panel showing decision audit (cron history,
webhook delivery audit, automation guardrail logs) needs the same.

### CountdownTimer

`<CountdownTimer expiresAtMs={1234567890} onExpire={fn} />` — live-ticking
clock with `setInterval(force, 500)` for half-second granularity.

Tones:

- `< 15s` → danger (red, pulsing)
- `< 30s` → warn (amber)
- otherwise → ok (green)

**Strong promotion candidate** — cron next-run countdowns (US-017),
webhook delivery retry windows (US-018), session expiry banners.

### CommandTag

`<CommandTag command="git push --force-with-lease" truncate={46} />` — mono
chip with truncation + full command in `title` attr.

## Per-section renderers

### Topbar

- Brand block (eyebrow + title + policy hash + runtime version).
- KPI strip: 5 KpiCell variants:
  - Pending exec (warn if > 0)
  - Pending plugin (warn if > 0)
  - Resolved 1h (neutral)
  - Denied 1h (warn if > 5)
  - Avg response (neutral, formatted as `Ns`)
- Policy button → opens PolicyEditor modal.
- Refresh button → spinner animation while refreshing.

### QueueList (left pane)

- Head: title + count badge (filtered count).
- Filters bar:
  - Kind seg-filter (All / Exec / Plugin) with per-kind counts.
  - Search input (live filter on command + subtitle + id).
- Rows: ordered by `expiresAtMs` ascending (most-urgent first):
  - Head row: KindBadge + CountdownTimer.
  - CommandTag (or pluginName).
  - Meta row: subtitle (agentId or requester with icon) + relative age.
- Visual:
  - Exec rows: 3px left border in warn tone.
  - Plugin rows: 3px left border in info tone.
  - Selected row: accent border + inset shadow.

### ApprovalDetail (right pane)

#### Hero

- Head: KindBadge + id chip + CountdownTimer.
- Title: monospace `command` (exec) or `pluginName` (plugin).
- 4 meta cells:
  - exec: agentId / cwd / runId / relative-age
  - plugin: pluginId / requester / capabilityKind / relative-age

#### Tabs (per kind)

- exec → 4 tabs:
  - **overview**: why-asked list + risk-surface paragraph
  - **argv**: parsed argv JSON + cwd
  - **plan**: SystemRunApprovalPlan (typically null for exec) + decision scope
  - **activity**: recent decisions on same agent
- plugin → 4 tabs:
  - **overview**: why-asked list + risk-surface paragraph
  - **scopes**: requestedScopes list + capabilityKind
  - **source**: pluginId + origin + sourceUrl + requester
  - **activity**: recent plugin decisions

#### DecisionBar

- Sticky at bottom of detail pane.
- Reason input (full-width, optional, recorded in audit).
- Action row:
  - Deny (err border, hover red tint)
  - Allow once (ok border, hover green tint)
  - Allow always (filled ok, white text)
- Phase strip:
  - `submitting` → "Submitting decision…" with `role="status"`.
  - `done` → green check + "Decision recorded." 600ms.

### Recent decisions strip

- 12 row grid (auto-fill, min 380px).
- Per row: DecisionBadge + KindBadge + CommandTag + actor + relative when + (italic) reason.
- Reason truncates with title attribute for full text.

### PolicyEditor (modal)

- Wide modal (max 720px, max-height 85vh).
- Head: title + close button (`aria-label="Close policy editor"`).
- Body sections:
  1. **Defaults**: 2-col grid of 4 PolicyField selects (security / ask /
     askFallback / autoAllowSkills).
  2. **Per-agent overrides**: list of agent rows. Each row has its own
     2-col grid + remove button.
  3. **Allowlist**: scrollable list of paths + add input (Enter or button).
- Foot: phase + Cancel + Save policy.
- Save: 600ms simulated delay → done indicator → 600ms close.

## Props (production target)

```ts
type ApprovalsAppProps = {};

type QueueListProps = {
  pendingExec: DeckGoPendingApproval[];
  pendingPlugin: DeckGoPluginApprovalEntry[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  kindFilter: "all" | "exec" | "plugin";
  onKindFilter: (kind: "all" | "exec" | "plugin") => void;
  query: string;
  onQuery: (q: string) => void;
};

type ApprovalDetailProps = {
  entry:
    | ((DeckGoPendingApproval | DeckGoPluginApprovalEntry) & { __kind: "exec" | "plugin" })
    | null;
  recentDecisions: Array<{
    id: string;
    kind: "exec" | "plugin";
    decision: string;
    actor: string;
    command: string;
    agentId: string | null;
    decidedAtMs: number;
    reason: string | null;
  }>;
  onDecide: (id: string, decision: string, reason: string) => void;
};

type DecisionBarProps = {
  entry: ApprovalDetailProps["entry"];
  onDecide: (id: string, decision: string, reason: string) => void;
};

type PolicyEditorProps = {
  policy: DeckGoApprovalPolicyResponse;
  onClose: () => void;
  onSave: (next: DeckGoApprovalPolicyResponse) => void;
};

type KindBadgeProps = { kind: "exec" | "plugin" | string };
type DecisionBadgeProps = {
  decision: "allow_once" | "allow_always" | "deny" | "expired" | "pending" | string;
};
type CountdownTimerProps = { expiresAtMs: number; onExpire?: () => void };
type CommandTagProps = { command: string; truncate?: number };
```

## Class-name intent

| Class                                                 | Purpose                                |
| ----------------------------------------------------- | -------------------------------------- |
| `.approvals-app`                                      | Top-level vertical layout              |
| `.approvals-app__topbar`                              | Sticky header with KPI + actions       |
| `.kpi-cell / --warn / --err / --ok`                   | KPI cell tone variants                 |
| `.approvals-app__btn / --primary / --spin`            | Topbar button + spinner state          |
| `.approvals-app__main`                                | 2-pane main grid                       |
| `.queue-list`                                         | Left pane container                    |
| `.queue-list__rows`                                   | Scrollable row list                    |
| `.queue-row / --on / --plugin / --exec`               | Selectable row + state + kind variants |
| `.seg-filter / __btn / --on`                          | Kind segmented control                 |
| `.search-input`                                       | Search bar                             |
| `.kind-badge / --exec / --plugin`                     | Per-kind badge variants                |
| `.decision-badge / --ok / --err / --warn`             | Per-decision badge variants            |
| `.countdown-timer / --ok / --warn / --danger`         | Live countdown variants                |
| `.command-tag`                                        | Mono command chip                      |
| `.approval-detail / --empty`                          | Right pane                             |
| `.approval-detail__tab / --on`                        | Tab variants                           |
| `.json-block`                                         | Pretty-printed JSON pre                |
| `.detail-section / __title`                           | Detail section wrapper + label         |
| `.decision-bar`                                       | Sticky decision bar                    |
| `.decision-bar__btn--deny / --allow / --allow-strong` | Decision action variants               |
| `.decision-bar__phase--running / --done`              | Phase strip variants                   |
| `.recent-decisions / __row`                           | Recent decisions strip                 |
| `.modal-backdrop / .modal / --wide`                   | PolicyEditor modal shell               |
| `.policy-section / __title`                           | PolicyEditor section wrapper           |
| `.policy-grid`                                        | 2-col grid for defaults                |
| `.policy-field / __label / __input`                   | Defaults select wrapper                |
| `.policy-agent-row / __head / __remove`               | Per-agent override row                 |
| `.policy-allowlist / __row / __remove / __add`        | Allowlist editor                       |

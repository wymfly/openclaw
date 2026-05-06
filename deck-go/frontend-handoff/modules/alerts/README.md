# Alerts (Rules CRUD)

**Status**: implemented (sha d7ab0bb9b612ca120ec1d1e7ced6bef92e8f2508)
**Design completed**: 2026-05-04
**Designer**: design agent (Claude)
**Depends on atoms**: Pill, Badge, Button, IconButton, Modal, Tabs, KbdHint, Avatar, EmptyState,
Input, RadioCard
**Depends on canonical patterns**: PageShell, EmptyState
**Depends on canonical icons**: IconSearch, IconChevronRight/Left, IconCheck, IconX, IconAlert,
IconInfo, IconRefresh, IconClock, IconBell, IconWebhook, IconActivity, IconToast, IconPlus,
IconTrash, IconKbd, IconCopy, IconCode, IconPower, IconEntity, IconThreshold
**New atoms needed**: none — local prototype molecules (`action-pill`, `threshold-tag`,
`condition-card`, `entity-tile`, `action-tile`) all map to existing atoms in production
**New tokens needed**: none — uses canonical `--ds-*`
**Backend endpoints used**: see `api-usage.md` (alert rules CRUD + BFF projections for fires + audit)

## What this module does

CRUD for alert rules. Each rule binds an entity type (channel / model / subagent / budget / …)
to a condition DSL with a threshold and an action sink (toast / activity / webhook). When the
backend's evaluator finds the condition true on aligned activity events, it fires the action
and starts a per-(rule × entityId) cooldown.

The panel handles four primary jobs:

1. **Browse rules** — filter by action, entity type, enabled/disabled.
2. **Create / edit** — RuleEditDialog with form (name, entity, condition, threshold, action,
   cooldown, enabled toggle).
3. **Test fire** — TestFireDialog dry-runs the rule and previews the action payload.
4. **Inspect history** — Recent fires (BFF projection over alert.fire activity events) + Audit
   timeline (CRUD history).

## How to implement

1. Open `prototype.html` in a browser:
   - 12 mock rules across 12 entity types and all 3 actions.
   - Click any row → Detail (4 tabs).
   - Hover row to see inline Test fire + Power toggle icon buttons.
   - Hero has Test fire / Disable / Edit / Delete actions.
   - Tweaks panel exercises every state, every dialog.
2. Read `components.md`, `states.md`, `interactions.md`, `api-usage.md` for engineering handoff.
3. Translate each `.jsx` file to TypeScript at the production target listed in `components.md`.

## Open questions for Claude Code

- **Condition DSL grammar.** Prototype renders the condition as raw text. Production may want
  syntax highlighting + autocomplete once the backend grammar is documented.
- **Webhook target binding.** Webhook action requires a registered URL; this binding lives in
  the webhooks module. Should the RuleEditDialog inline a webhook picker, or punt to a separate
  navigation? Current prototype assumes one default webhook target per workspace.
- **Test fire side-effects.** Prototype claims test fires don't reset cooldown. Confirm with
  backend.
- **Entity-id-aware cooldown.** Cooldown is per (rule × entityId). Surface this somewhere on
  the Recent fires tab when the same entityId fires multiple times.

## File inventory (v2)

```
alerts/
├── README.md
├── prototype.html                   ← ~30-line shell loading external .jsx via Babel standalone
├── prototype-v1-codex.html          ← preserved V1 single-file prototype
├── app.jsx                          ← list↔detail routing + 3 dialogs + ⌘K/⌘N/⌘R/Esc
├── list-view.jsx                    ← KPI strip + 4-axis filter + 8-col rule rows + inline icon buttons
├── detail-view.jsx                  ← Hero + 4 tabs (Overview/Conditions/Recent fires/Audit)
├── dialogs.jsx                      ← RuleEditDialog (form) + DeleteRuleDialog + TestFireDialog
├── data.js                          ← 12 rules across 12 entity types × 3 actions + recentFires + audit
├── icons.jsx                        ← 20 SVG icons + ActionPill + EntityGlyph (entity-aware avatar)
├── styles.css                       ← Linear-inspired
├── tokens.css                       ← mirror copy of canonical tokens
├── tweaks-panel.jsx                 ← shared design-time tooling
├── components.md
├── states.md
├── interactions.md
└── api-usage.md
```

## Reverse sign-off

| Field                          | Value                                                                                                                         |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Final sign-off status          | `needs-revision`                                                                                                              |
| Reviewer                       | Codex                                                                                                                         |
| Date                           | 2026-05-06                                                                                                                    |
| Prototype reference            | `frontend-handoff/modules/alerts/prototype.html`                                                                              |
| Production reference           | `frontend-new/src/components/panels/alerts/`                                                                                  |
| Mock functional evidence       | `frontend-handoff/audit/module-evidence-manifest.json` (`alerts`, `mock-functional`, verdict: `recorded-by-visual-spec`)      |
| Mock prototype parity evidence | `frontend-handoff/audit/module-evidence-manifest.json` (`alerts`, `mock-prototype-parity`, verdict: `unreviewed`)             |
| Real Gateway evidence          | `frontend-handoff/audit/module-evidence-manifest.json` (`alerts`, `real-gateway`, status: `recorded-in-implementation-notes`) |
| Accepted exceptions            | See `frontend-handoff/audit/module-evidence-manifest.json` and `frontend-handoff/modules/alerts/implementation-notes.md`.     |

This reverse sign-off is a current-code evidence index. It does not upgrade `unreviewed` prototype parity verdicts to visual acceptance; those remain explicit in the manifest.

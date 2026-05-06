# Subagents (Runs + Permissions)

**Status**: implemented (sha d7ab0bb9b612ca120ec1d1e7ced6bef92e8f2508)
**Design completed**: 2026-05-04
**Designer**: design agent (Claude)
**Depends on atoms**: Pill, Badge, Tag, Button, IconButton, Modal, Tabs, KbdHint, Avatar,
EmptyState, Input, RadioCard, Checkbox
**Depends on canonical patterns**: PageShell, SectionHeader, EmptyState
**Depends on canonical icons**: IconSearch, IconChevronRight/Left/Down, IconCheck, IconX,
IconAlert, IconInfo, IconRefresh, IconClock, IconActivity, IconStop, IconTarget, IconBranch,
IconShield, IconCode, IconCopy, IconKbd, IconArrowRight, IconLayers, IconSparkle, IconUser,
IconKey, IconHash, IconBrain
**New atoms needed**: none — local prototype molecules (`mode-pill`, `parent-row`, `tree-node`,
`perm-row`, `cap-num`) all map to existing atoms in production
**New tokens needed**: none — uses canonical `--ds-*` from
`frontend-handoff/design-system/tokens.css`
**Backend endpoints used**: see `api-usage.md` (subagents inventory + lineage + kill / steer +
per-agent permission config)

## What this module does

Operational live view of subagent runs + per-agent permission management. Two list modes the
operator switches between:

1. **Runs** (default) — every recent subagent run with status, duration, parent / child agents,
   model, spawn mode. Live runs sorted to the top. Click any row to inspect the full lineage,
   outcome JSON, parent permissions, and audit history. Live runs can be **killed** or **steered**
   from the hero.
2. **Permissions** — per-parent-agent allow-list configuration. Each row is one configurable
   parent agent (those that appear in `agents.subagent-config`). Edit opens a modal with checkbox
   grid + `allowAny` switch + default model.

Unlike plugins (read-only) or skills (config + hub), subagents has live operational concerns —
this is the only deck-go panel that can intervene on a running session via Steer + Kill.

Production implementation is complete in `frontend-new/src/components/panels/subagents/`.
Everything below is design handoff context; code truth remains the authority. Current production
uses `/api/deck/subagents` and `/api/deck/agents` action envelopes, and Gateway status filters are
`active | completed | failed | timeout | all`.

## How to implement

1. Open `prototype.html` in a browser:
   - **Runs** mode: 14 mock runs covering all 5 statuses (running / succeeded / failed / killed /
     stalled) + both spawn modes (blocking / background) + depth 1 and 2.
   - Click any row → Detail (6 tabs). Live runs show Steer + Kill in the hero; ended runs show
     only Raw.
   - **Lineage** tab renders the spawn tree (root → children → grandchildren) with the current
     run highlighted. Clicking a sibling navigates to its detail.
   - **Permissions** tab shows the parent agent's allow-list (read-only) with an Edit button
     that opens the same modal as the Permissions list mode.
   - Switch list mode (top toolbar segmented control) to **Permissions** to see 3 mock parent
     agent rows; click Edit on any to exercise the dialog.
   - Tweaks panel exercises every state, every dialog, every tab.
2. Read `components.md`, `states.md`, `interactions.md`, `api-usage.md` for engineering handoff.
3. Translate each `.jsx` file to TypeScript at the production target listed in `components.md`.
   Replace `__fixtures__` mock with real fetch hooks. Keep kebab-case classes verbatim.

## Open questions / follow-up

- **Lineage navigation off-tree.** Lineage renders nodes from `lineageMap[requesterSessionKey]`.
  When a sibling node references a different session (recursive subagent spawn jumps sessions),
  the prototype falls back to "navigate by runId" — production needs a `lineageMap[childSessionKey]`
  fallback too.
- **Steer dedupKey ergonomics.** Current contract accepts `instruction` only and returns optional
  server-generated dedup fields; client-generated dedup keys are not implemented.
- **Stalled detection.** Prototype models `status: "stalled"` as a backend signal. Current Gateway
  filter schema does not include it.
- **Permissions write path.** Production passes the previous `configHash` as `baseHash`; retry UI
  for hash mismatch remains follow-up.
- **Kill cascade.** Killing a parent run leaves its descendants orphaned. Confirm whether backend
  cascades the kill or if the operator has to walk the lineage manually.
- **Audit tab.** The v2 design includes audit, but no `/api/deck/subagents/<runId>/audit` route is
  declared. Production renders this as degraded.

## File inventory (v2)

```
subagents/
├── README.md                    ← this file
├── prototype.html               ← ~30-line shell loading external .jsx via Babel standalone
├── prototype-v1-codex.html      ← preserved V1 single-file prototype (reference)
├── app.jsx                      ← App shell + list↔detail routing + 4 dialogs + ⌘K/⌘P/⌘R/Esc
├── list-view.jsx                ← Two modes (Runs | Permissions) + KPI strip + 8-col runs / 6-col perms
├── detail-view.jsx              ← Hero + 6 tabs (Overview/Lineage/Outcome/Permissions/Audit/Raw)
├── dialogs.jsx                  ← KillRunDialog + SteerRunDialog + PermissionsDialog + RunOutcomeDialog
├── data.js                      ← contract-shaped MOCK with 14 runs + lineage + 3 agent configs + audit
├── icons.jsx                    ← 25 SVG icons + AgentGlyph (per-agent palette)
├── styles.css                   ← Linear-inspired, --ds-* tokens only, dark/light + density-aware
├── tokens.css                   ← mirror copy of canonical tokens
├── tweaks-panel.jsx             ← shared design-time tooling
├── components.md                ← production component skeleton + props shapes
├── states.md                    ← state machine + focus + a11y
├── interactions.md              ← keyboard / pointer / hover / dialog flows
├── api-usage.md                 ← endpoint truth + DTO shapes + BFF projections + assumptions
├── api-discrepancy.md           ← (preserved from V1) backend gap notes
└── implementation-notes.md      ← (preserved from V1) reverse-flow notes from Claude Code
```

## Reverse sign-off

| Field                          | Value                                                                                                                            |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Final sign-off status          | `needs-revision`                                                                                                                 |
| Reviewer                       | Codex                                                                                                                            |
| Date                           | 2026-05-06                                                                                                                       |
| Prototype reference            | `frontend-handoff/modules/subagents/prototype.html`                                                                              |
| Production reference           | `frontend-new/src/components/panels/subagents/`                                                                                  |
| Mock functional evidence       | `frontend-handoff/audit/module-evidence-manifest.json` (`subagents`, `mock-functional`, verdict: `recorded-by-visual-spec`)      |
| Mock prototype parity evidence | `frontend-handoff/audit/module-evidence-manifest.json` (`subagents`, `mock-prototype-parity`, verdict: `unreviewed`)             |
| Real Gateway evidence          | `frontend-handoff/audit/module-evidence-manifest.json` (`subagents`, `real-gateway`, status: `recorded-in-implementation-notes`) |
| Accepted exceptions            | See `frontend-handoff/audit/module-evidence-manifest.json` and `frontend-handoff/modules/subagents/implementation-notes.md`.     |

This reverse sign-off is a current-code evidence index. It does not upgrade `unreviewed` prototype parity verdicts to visual acceptance; those remain explicit in the manifest.

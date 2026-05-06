# Routing

> 2-card workbench for the deck-go agent route-binding contract: queue card (left) + selected-binding/simulator/activity card (right). v2 multi-file React rebuild via Babel-standalone.

**Status**: implemented (sha d7ab0bb9b612ca120ec1d1e7ced6bef92e8f2508)
**Design completed**: 2026-05-04 (v2 rebuild from V1 codex single-file)
**Designer**: design agent (Claude)
**Depends on atoms**: Pill, Button, Input, Select, Textarea, JsonView, Code
**Depends on patterns**: 2-card workbench (left = queue card, right = detail card); ConfirmRow inline gate (shared with docs/memory/nodes); MetricStrip (5-metric KPI strip — used by gateway, agents pilot)
**New atoms needed**: TierBadge (tier-tone pill), MatchChip (key/value chip), HashChip (config-hash with copy), ConflictMarker (advisory inline pill) — all promotion candidates, see implementation-notes.md
**New tokens needed**: none — uses canonical `--ds-*`
**Backend endpoints used**: `GET /deck/routing` (typed list), `POST /deck/routing` (action-discriminated: `validate`/`add`/`remove`/`simulate`); `PATCH` for DM scope reuses the existing config patch wrapper

## What this module does

Routing is the **agent route-binding workbench**. The contract treats incoming traffic — channel × account × peer × guild × team × roles — as a routing key, and returns the agent that should handle it. Operators use this panel to:

1. **Inspect the binding queue**: ordered most-specific (peer) → broad fallback (channel). 8 mock bindings span 5 tiers (peer / guild+roles / guild / team / channel) so reordering is visually meaningful.
2. **Detect advisory conflicts**: shadowing, subset, duplicate. Local heuristic flags conflicts in the rail; backend `validate` is authoritative when a real action is dispatched.
3. **Mutate config (hash-aware)**: every `add` / `remove` / `move` / `patch DM scope` requires the current `configHash`; mutations advance the hash and the panel re-renders the new value via `<HashChip>`.
4. **Simulate inbound traffic**: walk the match chain without sending a real message. The tier timeline shows matched / checked / skipped per tier and surfaces "fall-through to default" when no binding matches.
5. **Tail recent routing activity**: filtered slice of `routing.matched` / `route.fallback` / `routing.config.updated` events.

The panel is the **first deck-go module to need a `<HashChip>` + `<MutationStrip>` pair** — config mutations are the dominant interaction and the panel's whole UX is anchored on the hash advancing visibly after every successful action.

## How to implement

1. **Browser-open `prototype.html`** and try: select a binding → use as simulation → reorder via Move up/down → add a new binding via the draft panel → patch DM scope. Note the config hash advancing after every successful mutation.
2. Read [`components.md`](./components.md) — component tree + 12 local molecules + 5 tier tones.
3. Read [`states.md`](./states.md) — state machines for filters, draft, simulator, mutation lifecycle.
4. Read [`interactions.md`](./interactions.md) — keyboard, hover/focus, two-step confirm flow, edge cases.
5. Read [`api-usage.md`](./api-usage.md) — DTO source-of-truth + endpoint shapes + caching strategy + scope-and-audit table.
6. Read [`api-discrepancy.md`](./api-discrepancy.md) — preserved from V1 codex (open Gateway questions about reorder action, conflict severity, simulation explanation).
7. Read [`implementation-notes.md`](./implementation-notes.md) — design decisions, contract reconciliations, stack locks.

## File layout

```
routing/
├── prototype.html         # 22-line multi-script-tag shell
├── data.js                # 8 bindings × 5 tiers + 2 advisory conflicts + 5 activity events + simulator + mock responders
├── icons.jsx              # 23 svg icons + 7 molecules + 1 helper
├── tweaks-panel.jsx       # shared design-mode panel
├── routing-queue.jsx      # left card: metric strip + filter row + DM scope panel + binding list + add-draft panel
├── routing-detail.jsx     # right card: selected-hero + actions + JSON + simulator + activity + ConfirmRow + MutationStrip
├── app.jsx                # RoutingApp orchestrator + 6 mutation kinds + hash-aware lifecycle
├── styles.css             # ~900 lines — shell, metric strip, queue/detail cards, binding rows, tier badges, match chips, conflict markers, simulator timeline, activity, JSON view, hash chip, confirm + mutation strips
├── tokens.css             # canonical tokens mirror
└── prototype-v1-codex.html  # preserved V1 codex single-file prototype
```

## Open questions for implementation

- **Reorder action**: contract uses remove + add (two POSTs); should Gateway expose `node.routing.reorder` as a single typed call? See `api-discrepancy.md`.
- **Conflict severity**: prototype uses `type` (subset / shadowed-by / duplicate) only; backend may want `severity: "blocker" | "warn" | "info"` for stronger gating.
- **Conflict ownership**: who owns the advisory marker — Deck or Gateway? The prototype computes locally for fast feedback; backend `validate` is authoritative when adding.
- **Simulation explanation**: tier timeline shows matched/checked/skipped only. Should the contract grow a `tiers[].reason: string` field for human-readable "matched because peer.id === finance-lead"?
- **Stable binding IDs**: prototype uses computed-hash-as-id (`7c61b9d2ea11`); reordering changes order but not id — good. But add returns a new id from the BFF; ensure the UI doesn't assume id stability across reorders if the BFF chooses to recompute.
- **DM scope dependency**: scope changes can affect existing sessions (per-channel-peer → per-peer changes session-key derivation). Prototype just patches; production may want a "what changes" diff before commit.
- **Filter persistence**: filters are per-session in the prototype. Should they persist to URL hash so reload preserves them?
- **Bulk operations**: bulk delete, bulk move, bulk validate. Deferred — too risky without a "what would happen" preview.
- **Activity filter ownership**: prototype filters client-side. Production should add a server-side filter param to keep the payload small for high-traffic deployments.

## Why a 2-card workbench and not a list+detail page transition

Considered three layouts:

1. **List → page transition** (like agents): rejected because reordering is the dominant interaction and you need to see neighbor bindings while moving a row. Page transition would force operators to "remember" the queue context.
2. **Three-column** (queue + detail + simulator stacked horizontally): considered but the simulator and activity panels are tall, and three columns at 1280px would be cramped (each ~420px). Felt fragmented.
3. **2-card workbench** (chosen): queue stays sticky and dense; detail card is a single scrollable column with hero + actions + JSON + simulator + activity. The detail card reads top-to-bottom: "what is selected" → "what can I do to it" → "what happens if I simulate this binding's match chain" → "what just happened on this fleet". This vertical narrative is the natural operator workflow.

Same 2-card workbench shape used by gateway. Pattern is already canonicalized.

## Reverse sign-off

| Field                          | Value                                                                                                                          |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Final sign-off status          | `needs-revision`                                                                                                               |
| Reviewer                       | Codex                                                                                                                          |
| Date                           | 2026-05-06                                                                                                                     |
| Prototype reference            | `frontend-handoff/modules/routing/prototype.html`                                                                              |
| Production reference           | `frontend-new/src/components/panels/routing/`                                                                                  |
| Mock functional evidence       | `frontend-handoff/audit/module-evidence-manifest.json` (`routing`, `mock-functional`, verdict: `recorded-by-visual-spec`)      |
| Mock prototype parity evidence | `frontend-handoff/audit/module-evidence-manifest.json` (`routing`, `mock-prototype-parity`, verdict: `unreviewed`)             |
| Real Gateway evidence          | `frontend-handoff/audit/module-evidence-manifest.json` (`routing`, `real-gateway`, status: `recorded-in-implementation-notes`) |
| Accepted exceptions            | See `frontend-handoff/audit/module-evidence-manifest.json` and `frontend-handoff/modules/routing/implementation-notes.md`.     |

This reverse sign-off is a current-code evidence index. It does not upgrade `unreviewed` prototype parity verdicts to visual acceptance; those remain explicit in the manifest.

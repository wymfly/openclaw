# Implementation notes

> Author: design agent (Claude). Audience: future Claude Code (this fork) reading the v2 routing handoff.

This file is the design agent's running diary on the routing prototype. It captures the **why** behind decisions that aren't visible from the file tree alone.

## Contract reconciliation — DTO scope

The PRD framing referred to routing as a "rules-list / condition-builder" panel. The real `deck-go/contracts/source/deck-api.contract.ts:815-882` exposes a tier-specificity binding queue (`peer` → `guild+roles` → `guild` → `team` → `channel`) with **action-discriminated POSTs** and a **simulator** that walks the chain. The prototype reflects the contract verbatim:

- Bindings are tier-typed, not free-form rules.
- The "condition builder" is a flat 9-field draft (channel / accountId / peer.kind / peer.id / guildId / teamId / roles / comment) — operators don't compose Boolean conditions; they fill the match dimensions and the BFF auto-detects the tier.
- The simulator walks `["peer", "guild+roles", "guild", "team", "channel"]` in priority order and returns the first match — same algorithm as `deck.routing.simulate`.

Mismatch resolution policy (per protocol-v1 §5 "no silent distortion"): when the PRD framing diverged from the contract, the contract won. The PRD's "rules-list" terminology was retired in `README.md` in favor of "binding queue" / "tier specificity" — the same vocabulary the BFF uses.

## Stack lock — JSON viewer

The `<JsonView />` component (icons.jsx) is a **plain `<pre>` + click-to-copy button**. The prototype decided **against** CodeMirror / Monaco / json-tree-view here. Reasons:

1. The selected-binding-hero JSON view is **read-only** — operators don't edit JSON, they edit via the form fields above.
2. Routing surfaces 4-line bindings (`{ id, agentId, tier, match: {...} }`) — a 70 KB editor for a 4-line preview is wasteful.
3. JsonView is now used by **memory + nodes + routing** (3rd use). It met the design-system gate; promote to `@/design-system/molecules/JsonView` in the next DS batch.

If a future binding shape grows past ~30 lines, revisit this — but the contract says "tier + match dimensions", which caps the JSON depth at 2.

## Stack lock — local advisory conflict heuristic

`data.js#LOCAL_CONFLICTS` is a **fixture map keyed by binding id** that statically describes "this binding is a subset of binding X" / "this binding is shadowed by binding Y". The production frontend has two ways to compute conflicts:

1. **Local heuristic** — diff each binding against the rest of the queue using a simple subset/duplicate detector. Cheap, immediate, but advisory only.
2. **Server-side** — `POST /deck/routing { action: "validate", agentId, match }` returns a `DeckGoRoutingValidateResponse` with `conflicts: []`. Authoritative.

The prototype uses **(1) for the queue** (so operators see the warn pill instantly without round-tripping for every row) and **(2) for the draft** (so adds are gated by the BFF's view of the queue). This split is intentional:

- Advisory conflicts in the queue help operators **plan** ("this binding is shadowed; should I move it up?") — speed > authority.
- Authoritative conflicts on add help operators **commit** — authority > speed.

The advisory marker is **never a gate** — operator can always proceed. This matches the contract's `validate.ok: false` being advisory, not blocking.

## Stack lock — in-process simulator

`data.js#simulateRoute(input, bindings)` walks the queue in priority order and returns the first match. It's a **client-side mock** of `deck.routing.simulate` so the prototype stays self-contained (no BFF needed for visual smoke-test).

Production must replace this with `simulateRouting()` (the typed wrapper) — the response shape (`DeckGoRoutingSimulateResponse`) is byte-identical to what the prototype mock returns. The simulator algorithm is documented in `states.md` for production parity.

## Pattern emerging — hash-aware mutation lifecycle

This is the **first deck-go module where every interaction visibly advances a hash**. The pattern:

1. Operator edits something (scope / add / remove / move).
2. Two-step gate (ConfirmRow) — operator sees what's about to change + the current `configHash`.
3. Confirm → BFF returns new hash → MutationStrip echoes it → `<HashChip>` re-renders with the new value.

This makes the panel feel **transactional** rather than declarative. Operators see the version cursor advance and gain confidence that their change landed.

`<HashChip>` (icons.jsx) and `<MutationStrip>` (routing-detail.jsx) are the two new molecules that materialize this pattern. Both are reusable — promotion candidates as soon as a 2nd module needs hash-aware mutation UX (gateway config? settings?).

## Pattern emerging — 2-card workbench shell

Routing is the **second deck-go module to use the 2-card workbench** (after gateway). The shell:

```
[ rail card (left) ]    [ detail card (right) ]
  metric strip
  filter row              ConfirmRow / MutationStrip stack
  scope panel             SelectedBindingHero
  add-draft drawer        SimulatorPanel
  binding list            ActivityList
  count summary
```

Same vertical narrative as gateway: "what's selected" → "what can I do" → "what just happened". Pattern is canonical — promote to `@/design-system/patterns/2CardWorkbench` after the 3rd use.

## Component reuse cascade — DS gate triggers

This panel pushes three components past the design-system promotion gate (3rd use):

| Component    | Used by                            | Status                                |
| ------------ | ---------------------------------- | ------------------------------------- |
| `JsonView`   | memory / nodes / routing           | **Gate met (3rd use)** — promote      |
| `AgentChip`  | docs / memory / activity / routing | **Gate exceeded (4th use)** — overdue |
| `ConfirmRow` | docs / memory / nodes / routing    | **Gate exceeded (4th use)** — overdue |

Two new molecules (`HashChip`, `MutationStrip`) are 1st-use here — flag them as promotion candidates so they're visible when the 2nd module needs them (likely settings / gateway).

## Tone system across the action surface

Routing has **5 distinct tones** in the v2 prototype, each tied to a specific intent:

| Tone           | Surfaces                                                                     | Reason                                                 |
| -------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------ |
| `ok` (success) | matched simulation, validated draft, successful add/scope-patch              | Standard positive feedback                             |
| `warn`         | advisory conflict, fall-through to default, removed binding (impact summary) | "Operator should look but isn't blocked"               |
| `danger`       | Remove confirm only                                                          | Reserved for irreversible (or hard-to-reverse) actions |
| `neutral`      | checked-but-not-matched simulator tier, idle state                           | Default surface                                        |
| `accent`       | active selection, focused input, primary action button                       | "This is what you're operating on"                     |

The discipline: `danger` is only on Remove (and remove inside Move). Add is `warn` (high-friction confirm but not red). Scope patch is `warn` (hash advances; user should double-check). Simulate is non-destructive — `ok` or `warn` based on outcome, never `danger`.

## Notes on benign Babel-standalone diagnostics

Several TypeScript diagnostics fire when reading the `.jsx` files in isolation:

- `Property 'BINDINGS' may not exist on type 'Window'` — globals are exported via `Object.assign(window, { BINDINGS, ... })` in `data.js`; the analyzer can't see runtime augmentation.
- `Could not find name 'IconRoute' / 'TierBadge' / 'AgentChip' / ...` — these are exported via `Object.assign(window, { IconRoute, ... })` in `icons.jsx` and resolved at runtime.
- `Could not find name 'React'` — Babel-standalone exposes `React` globally from the `<script>` tag in `prototype.html`.

These are expected for the multi-script-tag pattern. Production code uses normal ES module imports and the diagnostics disappear.

## Outstanding open questions

The v1 codex prototype already documented these in `api-discrepancy.md`. They survive into v2 unchanged — none were resolved during this rebuild:

1. **Reorder action**: the contract uses remove + add (two POSTs). Should Gateway expose `node.routing.reorder` as a single typed call to eliminate the partial-failure window?
2. **Conflict severity**: `DeckGoRoutingConflict.type` is an open enum. Should it grow `severity: "blocker" | "warn" | "info"` for stronger gating?
3. **Conflict ownership**: who computes advisory conflicts — Deck (BFF) or Gateway (Deck view)? Prototype computes locally for fast feedback.
4. **Simulation explanation**: the tier timeline shows `matched / checked / skipped` but no "why" string. Should the contract grow `tiers[].reason: string` for human-readable explanation?
5. **Stable binding IDs**: prototype uses `id` from the contract, computed as a hash of match content. Reordering changes order but not id. But the BFF can re-compute on add — UI shouldn't assume id stability across reorders if the backend chooses to recompute.
6. **DM scope dependency**: scope changes can affect existing sessions (per-channel-peer → per-peer changes session-key derivation). Prototype just patches; production may want a "what changes" diff before commit.
7. **Filter persistence**: filters are per-session in the prototype. Should they persist to URL hash so reload preserves them?
8. **Bulk operations**: bulk delete, bulk move, bulk validate. Deferred — too risky without a "what would happen" preview.
9. **Activity filter ownership**: prototype filters client-side. Production should add a server-side filter param to keep the payload small for high-traffic deployments.

## Status of the V1 codex prototype

Preserved as `prototype-v1-codex.html` (672 lines, single-file). Useful for:

- Visual regression check against v2's component-extracted version.
- Reference if a v2 component decision needs second-guessing — "what did v1 do here?"
- Source-of-truth for the `api-discrepancy.md` open questions (verbatim from v1).

The v2 multi-file rebuild does not deviate visually from v1 — it only refactors the implementation into the standard 6-file structure (prototype.html / data.js / icons.jsx / routing-queue.jsx / routing-detail.jsx / app.jsx + styles.css + tokens.css + tweaks-panel.jsx) so each file maps 1:1 to a component boundary that Claude Code will materialize as a `.tsx` in `../frontend-new/src/components/panels/routing/`.

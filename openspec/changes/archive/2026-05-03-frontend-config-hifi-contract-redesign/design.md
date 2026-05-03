## Context

`frontend-new` already contains a functional `ConfigPanel` under the `config` panel id. It calls Deck-facing wrappers for config and schema operations:

- `fetchDeckConfig()` -> `GET /api/config`
- `applyDeckConfig(raw, baseHash)` -> `POST /api/config/apply`
- `lookupConfigPath(path)` -> `POST /api/config/schema-lookup`

The panel also uses local helpers for raw JSON parsing, top-level section discovery, structured field editing, sensitive-field masking, JSON draft handling, diff preview, and base-hash conflict recovery. DTO authority is `deck-go/contracts/source/deck-api.contract.ts`, generated into `DeckGoConfigSnapshotResponse`, `DeckGoConfigApplyResponse`, `DeckGoConfigLookupChild`, and `DeckGoConfigLookupResponse`.

The current UI preserves the important workflows, but it is visually still an old global `deck-ui-config*` control shell. The gap is visual and verification convergence: schema navigation, raw JSON diff/apply, structured fields, sensitive masking, and conflict recovery need a contract-led workbench layout and focused mock/local visual E2E.

## Goals / Non-Goals

**Goals:**

- Produce a complete Config handoff package.
- Rewrite Config into a high-fidelity config governance workbench aligned with the current design-system posture.
- Preserve load/error handling, raw edit dirty state, reset, diff preview, apply, base-hash conflict recovery, schema lookup, section filtering, structured field editing, sensitive reveal/hide, JSON draft apply/reset, payload disclosure, and localization.
- Add deterministic mock/local visual coverage for ready workspace, structured lookup/edit, diff preview or apply, and raw/lookup payload evidence.
- Record Config-specific design-system feedback without silently promoting atoms or patterns.

**Non-Goals:**

- No new Gateway method, BFF endpoint, event stream, or Deck-facing DTO contract unless implementation proves deterministic mismatch.
- No browser-side direct Gateway call.
- No schema authoring, schema migration generation, history/version restore, config import/export, secret vault integration, collaborative editing, or production rollback guarantee.
- No optimistic apply that bypasses `hash`/`baseHash` conflict semantics.
- No new dependencies, table libraries, JSON editor libraries, schema form libraries, diff libraries, or date libraries.
- No canonical design-system atom/pattern promotion inside this module change.

## Decisions

1. **Treat Config as a governance workbench.**
   The first viewport should show status, hash/dirty state, raw editor safety, schema navigation, structured fields, and apply/conflict evidence rather than presenting a generic JSON text area first.

2. **Preserve the Deck BFF contract boundary and base-hash semantics.**
   Config remains Deck BFF traffic. The rewrite keeps wrappers and route paths, and apply continues to use the currently loaded hash as the base.

3. **Use module-local config, schema, diff, conflict, and field molecules.**
   Config repeats compact workbench patterns from prior modules but adds schema/JSON/editor-specific semantics. Promotion waits for a separate design-system proposal.

4. **Keep raw JSON and structured fields synchronized through existing local helpers.**
   Structured edits update raw JSON; raw edits drive dirty state and diff preview. This change should not add a second source of truth.

5. **Make mock/local visual seeding deterministic through mock Gateway fixtures.**
   The visual E2E should exercise the real frontend against bundled mock Gateway config methods. No real Gateway config mutation or production config file is needed for visual convergence.

## Risks / Trade-offs

- **Risk: UI implies full schema-authoring or migration safety.** -> Keep copy scoped to current schema lookup and apply behavior.
- **Risk: Sensitive field controls imply secret vault protection.** -> Treat masking as UI display only; do not present vault/security guarantees.
- **Risk: Structured field editing diverges from raw JSON.** -> Continue using existing raw JSON helpers as the single state source.
- **Risk: Global CSS cleanup affects old panels.** -> Remove or narrow only Config-specific classes; keep new styling in module-local CSS.

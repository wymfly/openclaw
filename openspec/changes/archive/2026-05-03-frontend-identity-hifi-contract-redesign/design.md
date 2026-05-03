## Context

`frontend-new` already contains a functional `IdentityPanel` under the `identity` panel id. It calls Deck-facing wrappers for identity relationships and guarded mutations:

- `fetchIdentityLinks()` -> `GET /api/deck/identity`
- `linkIdentityPeer(canonical, channel, peerId, baseHash)` -> `POST /api/deck/identity` with `action: "link"`
- `unlinkIdentityPeer(canonical, channel, peerId, baseHash)` -> `POST /api/deck/identity` with `action: "unlink"`

The identity route is Deck BFF traffic. The backend route proxies Gateway `deck.identity.list`, `deck.identity.link`, and `deck.identity.unlink`. DTO authority is `deck-go/contracts/source/deck-api.contract.ts`, generated into `DeckGoIdentityPeer`, `DeckGoIdentityLink`, and `DeckGoIdentityLinksResponse`. The mutation safety contract depends on `configHash` from the list payload being sent back as `baseHash`.

The current UI preserves list, link, unlink, selected canonical, confirmation, missing-hash guard, and hash refresh after failed mutations, but it is visually still an old global `deck-ui-identity*` split layout. The gap is visual and verification convergence: canonical coverage, peer relationships, mutation safety, error recovery, and unsupported semantics are not organized as a contract-led workbench, and there is no focused mock/local visual E2E for the real frontend.

## Goals / Non-Goals

**Goals:**

- Produce a complete Identity handoff package.
- Rewrite Identity into a high-fidelity canonical relationship workbench aligned with the current design-system posture.
- Preserve load/error handling, selected canonical behavior, guarded link dialog, confirmed unlink, missing-hash guard, failed mutation refresh, direct peer unlink, last-action feedback, and localization.
- Add deterministic mock/local visual coverage for ready inventory, selected canonical detail, link dialog or guard state, unlink/mutation evidence, and raw payload or config-hash evidence.
- Record Identity-specific design-system feedback without silently promoting atoms or patterns.

**Non-Goals:**

- No new Gateway method, BFF endpoint, event stream, or Deck-facing DTO contract unless implementation proves deterministic mismatch.
- No browser-side direct Gateway call.
- No bulk merge, split, rename, deduplicate, trust, audit, identity proofing, channel lookup, or directory sync controls.
- No optimistic mutation that bypasses `configHash`/`baseHash`.
- No real identity provider integration, account ownership verification, contact graph inference, or production audit guarantee.
- No new dependencies, table libraries, graph libraries, modal libraries, date libraries, or schema editors.
- No canonical design-system atom/pattern promotion inside this module change.

## Decisions

1. **Treat Identity as a relationship and mutation-safety workbench.**
   The contract exposes canonical identities with peer mappings plus guarded link/unlink operations. The first viewport should show canonical coverage, peer coverage, channel mix, selected peer mappings, current hash state, and mutation feedback without inventing identity-proofing workflows.

2. **Preserve the Deck BFF contract boundary and base-hash guard.**
   Identity is explicitly classified as Deck BFF traffic. The rewrite should keep current wrappers and public route paths, and every mutation should continue to fail closed when `configHash` is absent.

3. **Use module-local canonical, peer, guard, dialog, and evidence molecules.**
   Identity repeats compact workbench patterns from earlier modules but adds relationship-specific mutation semantics. Promotion to shared patterns waits for a separate design-system proposal with enough relationship-management evidence.

4. **Separate inventory scanning from selected canonical operations.**
   Canonical rows should stay compact and selectable. Peer-level unlink, mutation safety, last action, raw payload, and detailed evidence belong in the selected detail area to keep the list scannable.

5. **Make mock/local visual seeding deterministic through mock Gateway fixtures.**
   The visual E2E should exercise the real frontend against the bundled mock Gateway for identity list/link/unlink. No real Gateway, identity provider, contact directory, or external channel account is needed for visual convergence.

## Risks / Trade-offs

- **Risk: UI implies identity ownership proofing or trust.** -> Keep copy and controls scoped to relationship mapping only; do not add trust/proof labels beyond the payload.
- **Risk: Mutations appear safe without a config hash.** -> Render missing-hash as a blocking guard and keep link/unlink disabled or fail-closed through the existing guard.
- **Risk: Direct peer unlink in the rail makes destructive action too easy.** -> Keep explicit confirmation and make selected-detail unlink the primary visible destructive action; any rail unlink remains clearly labeled and tested.
- **Risk: Global CSS cleanup affects other old control panels.** -> Remove or narrow only Identity-specific classes; keep new styling in module-local CSS.

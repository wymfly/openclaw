# Identity Handoff

Status: ready for production rewrite under `frontend-identity-hifi-contract-redesign`.

## Contract Truth

- Browser entry points:
  - `fetchIdentityLinks()` -> `GET /api/deck/identity`
  - `linkIdentityPeer(canonical, channel, peerId, baseHash)` -> `POST /api/deck/identity` with `action: "link"`
  - `unlinkIdentityPeer(canonical, channel, peerId, baseHash)` -> `POST /api/deck/identity` with `action: "unlink"`
- Deck-facing DTO authority:
  - `DeckGoIdentityPeer`
  - `DeckGoIdentityLink`
  - `DeckGoIdentityLinksResponse`
- Backend/Gateway chain:
  - Go route: `deck-go/backend/internal/server/inventory.go`
  - Gateway typed client: `deck.identity.list`, `deck.identity.link`, `deck.identity.unlink`
  - Generated Gateway methods include typed params/results for the three methods.
- Mutation safety:
  - `configHash` from list response is the only mutation base.
  - Link/unlink must pass it as `baseHash`.
  - Missing hash blocks mutation before confirmation.

## Product Frame

Identity is a canonical relationship workbench, not an identity provider console. The operator needs to understand which canonical identities exist, how many peers are mapped, which channels those peers come from, whether the config hash is usable for safe mutations, and whether the last mutation succeeded or forced a refresh.

## Workflow Constraints

- Keep all browser traffic behind the Go BFF. Do not call Gateway directly.
- Keep link/unlink as guarded mutations. Do not add optimistic state that bypasses refresh.
- Keep destructive unlink behind confirmation.
- Keep unsupported concepts out of the primary UI: bulk merge, split, rename, deduplicate, trust scoring, identity proofing, channel lookup, directory sync, contact graph inference, and production audit assurance.
- Label mock/local visual tests as mock/local evidence only.

## Implementation Notes

- First viewport should expose:
  - canonical count
  - peer count
  - channel mix
  - config hash status
  - canonical inventory rail
  - selected canonical peer detail
  - mutation safety strip
  - link action
  - raw payload disclosure
- Selection should prefer the current canonical if it still exists after refresh, otherwise the preferred canonical after mutation, otherwise the first canonical.
- Failed link/unlink refresh should be visible through updated hash and unchanged/mutated relationship payload.

## Open Questions

- Whether future Gateway contracts will add identity rename/merge/split operations.
- Whether channel display metadata should be joined into identity peers.
- Whether mutation audit history belongs in identity payloads or an Activity/Logs handoff.

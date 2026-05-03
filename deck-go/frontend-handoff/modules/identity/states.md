# identity — states (v2)

## Top-level state

```ts
{
  // Navigation
  selectedId: string | null,                 // current canonical
  query: string,                             // identity-nav search filter

  // Server-side snapshot
  fixture: {
    canonicals: DeckGoIdentityLink[],        // links shape from contract
    configHash: string,                      // baseHash for next mutation
    fetchedAt: number,                       // ms since epoch
    recentMutations: SaveEvent[],            // BFF projection
    bootstrap: DeckGoBootstrapStatusResponse,
    agentProfile?: DeckGoAgentIdentityResponse,
    channels: { id: string; label: string }[],
  },

  // Mutation lifecycle
  dialog: { kind: "link" | "unlink" | "rename" | "create" | "delete" } | null,
  unlinkTarget: DeckGoIdentityPeer | null,   // staged peer for UnlinkPeerDialog

  now: number,                               // for relative-time formatting
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

| Scenario                                | UI                                                                                                                             |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Initial load (no fixture yet)           | (production target) full-width loading shell — prototype always seeds.                                                         |
| `canonicals.length === 0`               | Identity nav: "No canonicals match." inline empty row. CanonicalDetail in `--empty` mode.                                      |
| Filtered nav results empty              | Nav: "No canonicals match."                                                                                                    |
| `selectedId === null`                   | CanonicalDetail empty card: "No canonical selected. Pick a canonical from the left rail…"                                      |
| Selected canonical has no peers         | Peer section: "No peers linked. Use Link peer to bind a channel peer." dashed-border callout.                                  |
| `bootstrap.ok === false`                | Warn banner: "Bootstrap not ready. Mutations disabled until /api/bootstrap/status returns ok=true." All hero actions disabled. |
| `bootstrap.gateway.connected === false` | (production target) topbar shows error pill — prototype simulates ok.                                                          |
| GET /api/deck/identity 5xx              | (production target) full-width retry overlay — prototype seeds fixture.                                                        |
| Mutation 4xx (validation)               | Dialog stays open in `phase--error`; retry button visible.                                                                     |
| Mutation 409 (baseHash drift)           | Dialog `phase--error` with "baseHash drift — refresh and retry"; UI MUST refetch on next Refresh.                              |
| Mutation 5xx                            | Dialog `phase--error`; refetch on next Refresh.                                                                                |

## Selected-canonical states

| `selected` shape                              | UI                                                                                                         |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `null`                                        | Empty card "Pick a canonical from the left rail."                                                          |
| Canonical with peers, non-system              | Hero with all 3 actions enabled; peer list with Unlink CTAs.                                               |
| Canonical with peers, name === "system"       | Hero with Rename + Delete disabled (immutable); peer list with Unlink available (system peers can change). |
| Canonical with empty peers, non-system        | Hero with Delete enabled; peer empty callout; Unlink rows hidden.                                          |
| Canonical with empty peers, name === "system" | Hero with all destructive disabled; empty callout.                                                         |
| Canonical name matches `agentProfile.agentId` | Hero shows emoji prefix from `agentProfile.emoji`.                                                         |

## Mutation lifecycle (3-phase wizard)

All 5 dialogs follow the same lifecycle:

```
opened ─[Cancel]─▶ closed
       ─[Confirm]─▶ running ─(720ms)─▶ done   ─(480ms)─▶ closed (parent commits)
                                       └─▶ error (12% simulated baseHash drift) ─[Cancel]─▶ closed
                                                                                 └─[Confirm]─▶ running
```

Notes:

- `running` phase is non-cancellable (Esc + backdrop are no-ops).
- `done` phase auto-closes after a 480ms grace; parent commits the
  mutation to local state and advances `configHash` (simulated by
  `advanceHash()` in prototype).
- `error` phase keeps the dialog open with retry (resubmit goes back to
  `running`).
- `CreateCanonicalDialog` does NOT simulate baseHash drift (creates are
  not concurrent-sensitive in prototype; production may still want it).

## Hero states (per canonical)

| Bootstrap | Canonical  | Peer count | Link | Rename | Delete |
| --------- | ---------- | ---------- | ---- | ------ | ------ |
| not-ready | any        | any        | ❌   | ❌     | ❌     |
| ready     | system     | any        | ✓    | ❌     | ❌     |
| ready     | non-system | 0          | ✓    | ✓      | ✓      |
| ready     | non-system | >0         | ✓    | ✓      | ❌     |

## A11y / focus rules

- After IdentityNav item click → focus jumps to `.canonical-detail__title`.
- After dialog dismiss → focus returns to the trigger button.
- After Link/Rename/Delete commit → focus returns to the trigger
  button (which may now reflect new state).
- After Unlink commit → focus returns to the next peer row's Unlink CTA
  (or the empty callout if list is now empty).
- ⌘K → focus the identity nav search input from anywhere.
- All form fields have visible focus rings (accent color + 2px ring).

## Boundary cases

- **`canonicals.length === 0`**: nav "No canonicals match" + main empty
  card. The "New" CTA in nav header stays enabled to bootstrap the
  registry.
- **Renaming to an existing name**: the create dialog has collision
  detection (`existingNames.includes(name)`); the rename dialog does
  not currently — production should add this.
- **`pairedDevices` from settings vs `peers` here**: distinct concepts.
  Devices are mobile-app pairings authenticated via tokens; peers are
  channel-message-source identities. Don't conflate in UI.
- **System canonical hover**: tooltip explains why Rename / Delete are
  disabled ("system canonical cannot be renamed/deleted").
- **Peer with no `lastSeenMs`** (newly linked, never seen): displays
  "—" in last-seen cell, no stale badge.

## Theme variants

- `data-theme="dark"` (default) — uses canonical `--ds-*` palette.
- `data-theme="light"` (Tweaks demo only) — overrides body via the
  `[data-theme="light"]` block. Production will flip the entire token
  set, not just body — this is a visual sanity stub, not a complete
  theme.

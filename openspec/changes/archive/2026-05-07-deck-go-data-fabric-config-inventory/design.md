# Design: Config And Inventory Data Fabric Migration

## Module Boundaries

The implementation SHALL create or reuse one Data Fabric module per scoped
product module:

| Module     | Primary reads                                                                                                         | Primary writes                                     | Freshness                                                            |
| ---------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------- |
| `skills`   | `/skills`, skill hub bins/search/detail, plugin approvals                                                             | skill update/install/hub actions                   | `inventory`, `lazy-detail`, config-safe mutations                    |
| `models`   | runtime configured models/auth/catalog via Gateway RPC, `/models/config`, usage aliases currently displayed in Models | models config save, auth probe                     | `inventory`, `config-authority`, `historical` for usage if kept here |
| `channels` | `/channels`, throughput, routing summaries used by channel subviews                                                   | test/probe, logout, channel config patch           | `config-authority`, `live-workbench` for throughput                  |
| `routing`  | `/deck/routing`, recent activity used for routing context                                                             | add/remove/simulate/validate/dm-scope patch        | `config-authority`, `lazy-detail` for simulation                     |
| `nodes`    | `/nodes`, `/nodes/pair`, node detail                                                                                  | rename/invoke/pending/pair actions                 | `inventory`, mutation safety per evidence                            |
| `settings` | `/settings`, runtime endpoint, settings version, devices/self-device                                                  | save settings, test connection, endpoint save/test | `config-authority`, `live-workbench` for pairing/devices             |
| `plugins`  | `/deck/plugins`, channels used for plugin context                                                                     | plugin approval actions are out of this change     | `inventory`                                                          |
| `docs`     | `/docs`, `/docs/{docId}`                                                                                              | extract/delete                                     | `inventory`, `lazy-detail`                                           |
| `memory`   | browse/search/health/dreams                                                                                           | dreams/search actions                              | `inventory`, `lazy-detail`                                           |
| `config`   | `/config`, schema lookup                                                                                              | apply/patch                                        | `config-authority`                                                   |

Each module SHALL use the same pattern established by Agents:

```text
frontend-new/src/data/modules/<module>/
├── index.ts
├── keys.ts
├── queries.ts
├── mutations.ts        # only when writes exist
├── projections.ts      # only when live projection metadata exists
└── *.test.ts(x)
```

Shared cross-module reads MAY be reused instead of duplicated. For example,
`models` runtime configured models can remain a query source used by Agents and
Models, and `channels` can expose channel inventory used by Plugins.

## Contract Mapping Rules

1. Data hooks SHALL wrap existing `src/api.ts` facades unless a facade is
   missing or violates the browser-to-backend boundary.
2. Gateway protocol adapter reads SHALL use the existing generated Gateway RPC
   facade path through the deck-go backend; browser code SHALL NOT construct
   Gateway URLs.
3. BFF reads SHALL be named as BFF/product sources in query metadata and SHALL
   keep raw paths inside `src/api.ts` or the data module, not inside panel code.
4. List-query contract semantics SHALL be encoded where declared. Currently
   `docs-list` filter/search parameters are the explicit Phase 2 list contract.
5. Dynamic-surface or upstream-schema-missing exceptions SHALL be documented in
   the module design/test evidence instead of hidden in panel code.

## Query Keys

All keys SHALL be serializable and start with `deckKeys.scope(<module>)` or a
module-local prefix compatible with the Data Fabric foundation. Every mutation
and live projection policy SHALL invalidate keys through these factories.

Required key groups:

- list/inventory keys for all scoped modules;
- detail keys for docs, nodes, skill hub detail, and other detail reads;
- config snapshot/hash keys for config, models config, channel config, routing
  bindings, settings;
- action/preview keys for routing validate/simulate and model auth probe only
  when the result is rendered as server state rather than a transient command.

## Mutation Safety

Mutations SHALL be conservative by default:

- `retry: false`;
- `networkMode: "online"`;
- no offline replay;
- no optimistic updates unless there is a focused test for rollback behavior;
- explicit success invalidation;
- draft preservation on recoverable failures.

Hash behavior SHALL follow `deck-config-write-safety.contract.json`:

- `client-required` writes block before backend calls if the required hash is
  missing.
- `client-optional` writes pass the available hash and preserve local draft on
  conflict-like failures.
- `backend-derived`, `not-applicable`, and `no-hash` writes SHALL NOT invent a
  client hash requirement.

Real E2E write behavior SHALL follow `deck-mutations.contract.json` evidence:
`fixture-safe` writes may execute; `deferred` writes need reversible fixtures;
`skipped-safe` writes use shape/validation checks unless a disposable fixture is
already provided by the existing real spec.

## Live Projection Behavior

Only current contract metadata may be used.

- `device-pairing` events SHALL invalidate or mark stale settings/device pairing
  keys and follow `gapPolicy: refresh`.
- `routing-bindings` has no stream events and `gapPolicy: none`; Data Fabric
  SHALL not invent a live subscription for it.
- No module may require generated `patchStrategy` or `patchKeys`.

## Panel Migration Rules

For each scoped panel:

1. Replace first-load/background-refresh server fetch effects with Data Fabric
   hooks.
2. Preserve local UI state, drafts, filters, selected item, search text, tabs,
   dialog state, and visual layout.
3. Use cached data during background refresh errors.
4. Keep commands that are purely user-triggered and transient as mutations, not
   queries.
5. Do not move raw URL/action strings into panel components while migrating.

## Verification Strategy

Module implementation SHALL proceed in vertical slices. For every module slice:

1. Add keys/queries/mutations/projections and focused tests.
2. Migrate the panel and focused panel tests.
3. Run the narrow test slice before broadening.

Final verification SHALL include:

- `openspec validate deck-go-data-fabric-config-inventory --type change --strict`
- focused Data Fabric/module tests for the scoped modules
- `cd deck-go/frontend-new && npm run test:deck-ui`, with any unrelated failures
  recorded exactly
- `cd deck-go && make frontend-build`
- `cd deck-go && make contract-gate`
- L4 mock-functional evidence for the scoped module specs:
  `skills`, `models`, `channels`, `routing`, `nodes`, `settings`, `plugins`,
  `docs`, `memory`, and `config`
- L5 real-gateway evidence for the same module specs, or circuit-breaker
  handoffs after two environment/startup failures without new narrowing evidence

## Open Questions Resolved By This Proposal

- The change uses per-module Data Fabric directories instead of one large
  `configInventory` module because invalidation and hash semantics differ by
  product module.
- Visual redesign is explicitly out of scope; any E2E locator changes must be
  tied to current behavior, not aesthetic preference.
- Models usage aliases shown inside Models remain in scope only insofar as they
  are already part of the Models panel server state. Broader Usage module
  migration belongs to the live-workbench change.

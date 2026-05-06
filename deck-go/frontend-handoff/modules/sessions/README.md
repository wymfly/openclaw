# sessions - high-fidelity handoff

**Status**: implemented (sha d7ab0bb9b612ca120ec1d1e7ced6bef92e8f2508)
**Protocol version:** `protocol-v1`
**Active visual target:** [`./prototype.html`](./prototype.html)
**OpenSpec changes:** `frontend-sessions-hifi-contract-redesign`,
`frontend-sessions-real-contract-verification`

This package defines the visual and interaction target for the `sessions/`
module rewrite in `frontend-new`. The current panel is behavior-rich and
already goes through the Deck BFF contract chain, but this package is the visual
truth for the high-fidelity pass. Code and contracts remain the final authority
when a handoff note drifts.

Implementation and real-stack verification notes live in
[`implementation-notes.md`](./implementation-notes.md). Treat code, source
contracts, and generated contract checks as the final truth if this package
drifts again.

## What this module does

`sessions/` is the session operations workbench. Operators use it to browse and
filter recent sessions, inspect selected-session runtime and transcript
evidence, review usage/context weight, manage compaction checkpoints, inspect
subagent lineage/relations, export transcript evidence, and run session actions
such as reset, clear, patch, compact, and delete.

The design is dense but compartmentalized: inventory on the left, selected
session evidence in the center, action controls on the right. It repeats the
chat/agents/routing/subagents/logs/settings typography and token posture while
keeping session-specific list/detail/timeline molecules local.

## Contract truth

Production and mocks must use the current Deck-facing DTOs:

- `DeckGoSessionMeta`
- `DeckGoSessionsListResponse`
- `DeckGoSessionsPreviewResponse`
- `DeckGoSessionDetailResponse`
- `DeckGoChatHistoryResponse`
- `DeckGoSessionMutationResponse`
- `DeckGoCompactionCheckpoint`
- `DeckGoCompactionListResponse`
- `DeckGoCompactionActionResponse`
- `DeckGoUsageSessionsResponse`
- `DeckGoUsageSessionEntry`
- `DeckGoUsageSessionLogsResponse`
- `DeckGoUsageSessionLogEntry`
- `DeckGoContextWeightReport`
- `DeckGoSubagentsLineageResponse`

Endpoint truth:

- `GET /sessions`
- `POST /chat/sessions/preview`
- `GET /sessions/{sessionKey}`
- `GET /chat/history`
- `GET /usage/sessions`
- `GET /usage/sessions/logs`
- `POST /deck/subagents` with `action: "lineage"`
- `POST /chat/sessions/reset`
- `POST /chat/sessions/clear`
- `DELETE /chat/sessions`
- `POST /chat/sessions/patch`
- `POST /chat/compact`
- `POST /chat/compaction`

## Workflow constraints

- Browser code must continue through the Deck BFF/API facade.
- Session list/detail/history/usage/compaction/lineage shapes are BFF
  projections, not direct Gateway wire frames.
- Transcript cache behavior must survive the visual rewrite:
  `getCachedTranscript`, `setCachedTranscript`, `invalidateTranscript`.
- Compact and delete actions must keep a confirmation gate.
- Patch model/directive actions must keep the existing payload semantics.
- Export preview is client-side only and must not mutate server state.

## Depends on canonical atoms

`Badge`, `Button`, `Card`, `Code`, `Input`, `Select`, `SegmentedControl`,
`Spinner`, `Toggle`, `Modal` if a modal is chosen, and table/text atoms where
production fit is straightforward.

No canonical atom or token is required by this handoff. Local molecules:

- session metric tile
- inventory row
- selected-session hero
- transcript search/export seam
- context-weight row
- usage timeline row
- compaction checkpoint row
- lineage/relations row
- action result seam

## How to implement

1. Open `prototype.html` and inspect ready, filtered, selected-subagent,
   compaction, export, action, empty, loading, and error states.
2. Read `api-usage.md` before touching mocks, API wrappers, or backend behavior.
3. Translate the prototype into `frontend-new/src/components/panels/sessions/`,
   preserving wrappers, transcript cache, confirmation gates, and selection
   refresh behavior.
4. Restyle session-only helper components as part of this module pass.
5. Add mock visual E2E with contract-shaped data and label evidence as mock
   visual coverage.
6. Update `implementation-notes.md` with production divergence, verification
   evidence, and design-system feedback.

## Open questions for follow-up

- Whether session inventory needs a real server-side pagination/cursor contract
  instead of fetching a broad limit and paging locally.
- Whether compaction checkpoint responses should get stricter generated result
  schemas beyond the current action envelope.
- Whether session patch should expose a schema-guided form for every supported
  patch field, or stay scoped to model/label/thinking/fast mode here.
- Whether lineage belongs in sessions long-term or should deep-link more
  strongly into the subagents module.
- Whether the transcript export seam should become a shared pattern after usage
  or docs repeats it.

## Reverse sign-off

| Field                          | Value                                                                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Final sign-off status          | `accepted-with-exceptions`                                                                                                      |
| Reviewer                       | Codex                                                                                                                           |
| Date                           | 2026-05-06                                                                                                                      |
| Prototype reference            | `frontend-handoff/modules/sessions/prototype.html`                                                                              |
| Production reference           | `frontend-new/src/components/panels/sessions/`                                                                                  |
| Mock functional evidence       | `frontend-handoff/audit/module-evidence-manifest.json` (`sessions`, `mock-functional`, verdict: `recorded-by-visual-spec`)      |
| Mock prototype parity evidence | `frontend-handoff/audit/module-evidence-manifest.json` (`sessions`, `mock-prototype-parity`, verdict: `pass-with-exceptions`)   |
| Real Gateway evidence          | `frontend-handoff/audit/module-evidence-manifest.json` (`sessions`, `real-gateway`, status: `recorded-in-implementation-notes`) |
| Accepted exceptions            | See `frontend-handoff/audit/module-evidence-manifest.json` and `frontend-handoff/modules/sessions/implementation-notes.md`.     |

This reverse sign-off is a current-code evidence index. It does not upgrade `unreviewed` prototype parity verdicts to visual acceptance; those remain explicit in the manifest.

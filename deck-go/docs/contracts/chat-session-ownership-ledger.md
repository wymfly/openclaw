# Chat / Session Ownership Ledger

This ledger tracks migration ownership for the chat/session phase.

Allowed ownership values:

- `legacy-owned`
- `deck-go-owned`
- `adapter-window`

## Workflow Ledger

| Workflow / Surface                 | Current implementation anchor                                                   | Current owner  | Target owner                                       | Source of truth                                | Rollback trigger                                                       | Rollback action                                                                     | Deferral rationale / Notes                                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------- | -------------- | -------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Agent tabs / agent selection       | `dashboard/src/components/panels/chat/*` navigation layer                       | legacy-owned   | deck-go-owned                                      | deck-go session/agent selection state          | agent switching regresses or loses discoverability                     | revert this row to legacy-owned selection path                                      | migrate with Tranche `3A`                                                                          |
| Session list load                  | `dashboard/src/components/panels/chat/chat-api.ts:214` `fetchSessionList()`     | legacy-owned   | deck-go-owned                                      | deck-go session-list contract                  | list load or ordering regresses                                        | revert this row to legacy-owned fetch path                                          | move to dedicated session-list contract                                                            |
| Session preview overlay            | `dashboard/src/components/panels/chat/chat-api.ts:241` `fetchSessionPreviews()` | legacy-owned   | deck-go-owned                                      | deck-go preview contract when migrated         | preview overlay regresses or becomes misleading                        | revert this row to legacy-owned preview path                                        | likely adapter-window initially                                                                    |
| Chat snapshot                      | `deck-go/backend/internal/server/chat_snapshot.go`                              | adapter-window | deck-go-owned                                      | deck-go snapshot projection                    | snapshot projection diverges from session detail contract              | fall back to legacy snapshot/bootstrap path for this row                            | already exists, needs formal contract                                                              |
| Chat history seam                  | `deck-go/backend/internal/server/chat.go` `GET /chat/history`                   | adapter-window | deck-go-owned                                      | deck-go transcript seam                        | history seam returns mismatched ordering or missing content            | fall back to legacy history normalization for this row                              | explicit transcript seam                                                                           |
| Send action                        | `deck-go/backend/internal/server/chat.go` `POST /chat/send`                     | adapter-window | deck-go-owned                                      | deck-go send action contract                   | send fails or response stream cannot be projected correctly            | revert send path to legacy-owned action for this row                                | keep semantics, redesign DTOs later                                                                |
| Abort action                       | `deck-go/backend/internal/server/chat.go` `POST /chat/abort`                    | adapter-window | deck-go-owned                                      | deck-go abort action contract                  | abort regresses before/after reconnect                                 | revert abort path to legacy-owned action for this row                               | same                                                                                               |
| Session create                     | `deck-go/backend/internal/server/chat.go` `POST /chat/sessions/create`          | adapter-window | deck-go-owned                                      | deck-go session-create action contract         | new sessions cannot be created or selected reliably                    | revert create path to legacy-owned action for this row                              | same                                                                                               |
| Session reset action               | `deck-go/backend/internal/server/chat.go`                                       | adapter-window | deck-go-owned                                      | explicit adapter-window legacy/deck-go seam    | reset semantics drift or become ambiguous                              | keep this row adapter-window for all of Phase 3                                     | not promoted to first-class in Phase 3                                                             |
| Session clear action               | `deck-go/backend/internal/server/chat.go`                                       | adapter-window | deck-go-owned                                      | explicit adapter-window legacy/deck-go seam    | clear semantics drift or become ambiguous                              | keep this row adapter-window for all of Phase 3                                     | not promoted to first-class in Phase 3                                                             |
| Session patch action               | `deck-go/backend/internal/server/chat.go`                                       | adapter-window | deck-go-owned                                      | explicit adapter-window legacy/deck-go seam    | patch semantics drift or become ambiguous                              | keep this row adapter-window for all of Phase 3                                     | avoid generic patch drift                                                                          |
| Session event subscribe            | `deck-go/backend/internal/server/session_events.go`                             | adapter-window | deck-go-owned                                      | deck-go live session-event contract            | per-session live updates regress                                       | revert subscription handling for this row                                           | continuation seam for live per-session updates                                                     |
| Global SSE stream                  | `deck-go/backend/internal/server/stream.go`                                     | deck-go-owned  | deck-go-owned                                      | deck-go stream contract                        | replay / `projection.gap` / event continuity regress                   | block tranche completion; do not widen migration                                    | source of truth for `Last-Event-ID` / `projection.gap`                                             |
| Status / SSE / exception banners   | legacy chat shell status surfaces                                               | legacy-owned   | deck-go-owned                                      | deck-go runtime/bootstrap/event surfaces       | status/error behavior becomes hidden or misleading                     | revert banner/status presentation for this row                                      | redline capability; must remain visible during migration                                           |
| Tool progress / run status surface | legacy mixed projection                                                         | legacy-owned   | deck-go-owned                                      | deck-go tool/run projection                    | tool progress or run status stops matching runtime truth               | revert this row to legacy projection path                                           | migrate with Tranche `3C`                                                                          |
| Approval surface                   | legacy approval UI/state                                                        | legacy-owned   | deck-go-owned                                      | deck-go approval projection                    | approval discoverability/actionability regresses                       | revert this row to legacy approval path                                             | migrate with Tranche `3C`                                                                          |
| Transcript search / filter         | legacy transcript toolbar/search state                                          | legacy-owned   | deck-go-owned                                      | deck-go transcript + React shell filter state  | search/filter becomes materially weaker than product baseline          | revert this row to legacy toolbar/search path                                       | migrate with Tranche `3D`                                                                          |
| Artifact surface                   | legacy right-panel composition                                                  | legacy-owned   | deck-go-owned                                      | deck-go artifact projection + right-rail shell | artifact entry or rendering regress                                    | revert this row to legacy artifact panel path                                       | keep explicit right-rail discoverability                                                           |
| Canvas / A2UI surface              | legacy right-panel composition                                                  | legacy-owned   | deck-go-owned                                      | deck-go canvas projection + right-rail shell   | canvas entry or interaction regress                                    | revert this row to legacy canvas panel path                                         | keep explicit right-rail discoverability                                                           |
| Session-scoped configuration       | legacy session config bar/state                                                 | adapter-window | adapter-window                                     | explicit adapter-window config seam            | config editing needs new action shape or generic patch semantics drift | keep adapter-window through all of Phase 3; preserve current writes via legacy path | preserve `fastMode`, `thinkingLevel`, `responseUsage`, `sendPolicy` writes; re-evaluate in Phase 4 |
| Client-side stream routing         | `dashboard/src/components/panels/chat/useChatSSE.ts`                            | legacy-owned   | deck-go-owned contract consumed by new React shell | deck-go continuity contract                    | continuity semantics regress                                           | revert this row to legacy stream routing                                            | continuity semantics baseline                                                                      |
| Session-scoped state               | `dashboard/src/stores/chat.ts`, `chat-types.ts`                                 | legacy-owned   | new deck-go React product shell                    | deck-go React shell state                      | migrated shell state regresses task flow                               | revert affected row(s) to legacy-owned state path                                   | baseline for product capabilities                                                                  |

## Continuity Source of Truth

| Concern                           | Source of truth                                     | Notes                                                                  |
| --------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------- |
| `Last-Event-ID`                   | `deck-go/backend/internal/server/stream.go`         | stream contract authority                                              |
| `projection.gap`                  | `deck-go/backend/internal/server/stream.go`         | emitted by deck-go, not React                                          |
| Transcript snapshot               | runtime-facing `sessions.get`, projected by deck-go | explicit seam                                                          |
| Transcript live stream            | runtime event stream normalized by deck-go          | React should not invent runtime truth                                  |
| Snapshot/live merge rule          | deck-go contract + React shell behavior             | must be explicit in later tests                                        |
| Tool/result projection continuity | deck-go projection + React shell rendering          | must be proven before the live conversation tranche is called complete |
| Status / banner truth             | deck-go runtime/bootstrap/event surfaces            | shell must not invent operator state from ad hoc browser-local guesses |

## Action Disposition Baseline

### First-class Phase 3 actions

- session create
- send
- abort
- session-events subscribe / unsubscribe

### Explicit adapter-window actions

- preview
- reset
- clear
- patch
- session-scoped configuration

Directive:

- if an adapter-window action remains, its workflow row must carry an explicit rollback trigger and deferral rationale
- do not expand generic `patch` semantics just to preserve legacy route shape

## Rollback Trigger Baseline

Rollback trigger examples during adapter-window:

- a must-keep workflow regresses
- continuity semantics regress (`Last-Event-ID`, replay, `projection.gap`, merge rule)
- a migrated page shell drops a required capability

Rollback unit:

- one workflow row from the table above

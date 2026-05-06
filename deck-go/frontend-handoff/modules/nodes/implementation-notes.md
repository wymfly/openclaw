# Implementation notes — nodes

> Per `frontend-handoff/CLAUDE.md` protocol enhancement #5 (后端契约协商). Records design decisions and contract reconciliations for the v2 multi-file rebuild.

## Stack lock — JSON viewer

**Decision (LOCKED):** the in-house `<JsonView>` (in `icons.jsx`) is sufficient for production. It's ~30 lines, has clipboard support, scrolls bounded, and uses the canonical mono font + tokens. No external library needed (json-tree, react-json-view) — we don't need collapsible nested keys for these payloads (they're at most 3 levels deep and 100 lines).

If a future contract grows deeply-nested invoke payloads (e.g., file-tree responses), reconsider with `react18-json-view` (10kB, MIT, supports collapse + diff).

## Stack lock — JSON params textarea

**Decision (LOCKED):** plain `<textarea>` validated as `JSON.parse` only. No CodeMirror, no Monaco, no JSON Schema validation.

Rationale:

- Each command's param shape is unknown to the contract — there's no schema to validate against
- Adding a code editor (CodeMirror 6 = ~50kB) for a 5-line JSON blob is overkill
- Operators paste JSON from runbooks or templates; freeform editing is rare

If `node.commands.describe` lands and gives JSON Schema per command, replace this with the api-explorer's `<FormGenerator>` (in-house, already locked for that panel).

## Contract reconciliation — DTO shape

**Discovered:** the original PRD framed nodes as a "compute-resource inventory" with hostname / region / health / load fields. None of those exist in `deck-go/contracts/source/deck-api.contract.ts`. The actual surface is a **device trust + remote-control workbench** with these fields per node:

- identity: `nodeId`, `displayName`, `platform`, `deviceFamily`, `modelIdentifier`, `remoteIp`
- versions: `version`, `coreVersion`, `uiVersion`
- runtime: `caps[]`, `commands[]`, `pathEnv`, `permissions{}`, `connectedAtMs`
- state: `paired: boolean`, `connected: boolean`

And spans **8 distinct DTOs**: `DeckGoNodeSummary`, `DeckGoPairingRequest`, `DeckGoNodesResponse`, `DeckGoNodePairingResponse`, `DeckGoNodePairRequestInput`, `DeckGoNodePairRequestResponse`, `DeckGoNodeInvokeResponse`, `DeckGoNodePendingEnqueueResponse` + 2 enums (`DeckGoNodePendingWorkType`, `DeckGoNodePendingWorkPriority`).

**What this changed in framing:** the panel is not a "compute node inventory". It is a **device trust + remote-control operations workbench** with three jobs:

1. trust state surveillance (connection × pairing matrix)
2. pairing flow management (approve/reject/request/verify)
3. guarded remote actions (invoke + pending work — both flagged as dynamic envelopes)

Operators don't care about CPU load or region (those are infrastructure concerns); they care about whether a device is paired, connected, what commands it advertises, and whether they can safely dispatch a command.

**Resolution applied:**

1. Reframed as 2-pane workspace: rail (KPIs + pending pairing surface + inventory list) + detail (hero + lifecycle + pairing actions + capabilities + invoke + pending work + raw JSON)
2. Lifecycle tone derived from `(paired, connected, pendingForNode)` triple — drives StatusDot color, KPI tone, and lifecycle pill
3. Confirm gate on **every** mutating action (rename / invoke / pending / pair.\*); reject is `danger: true`, others are `danger: false`
4. Orphan pairing detail mode: pending request without inventory match → minimal detail (approve/reject only, no describe call)
5. Mock `ACTION_FIXTURES` reproduce realistic shapes (verbatim payloads + revision counters + status enums)
6. Capabilities surface separates `caps[]` (advertised features) from `commands[]` (invokable verbs) — rendered as different chip tones
7. Permission grid renders `Record<string, boolean>` as ok/denied chips; "no permission map" muted state when empty

**Implication for translation (`frontend-new/src/components/panels/nodes/`):**

- Use `import type { DeckGo* } from "@/types/deck-api"` for all 8 DTOs + 2 enums
- Wire `fetchNodes()` / `describeNode()` / `renameNode()` / `invokeNodeCommand()` / `enqueueNodePendingWork()` from `frontend-new/src/api/nodes.ts`
- Wire `fetchNodePairing()` / `requestNodePairing()` / `approveNodePairing()` / `rejectNodePairing()` / `verifyNodePairing()` from same file
- The rail's KPI counts must derive from the live response, not be cached
- Orphan pairing detection: `pairing.find((p) => !nodes.some((n) => n.nodeId === p.nodeId))`
- Replace mock 360ms latency with real fetch + optimistic UI (mark request as "approving…" while POST is in flight)
- Dynamic envelopes (`invoke`, `pending.enqueue`) must render the BFF response verbatim — do not interpret payload semantically

**No backend change needed.** The contract was correct; the PRD's "compute inventory" framing was the only friction.

## Pattern emerging — 2-pane workspace shell

The nodes panel is the **third deck-go module** to use the 2-pane workspace shape (rail + main column with sticky rail). The other two:

- **docs**: tree + viewer
- **memory.browse** (sub-tab): file tree + content viewer

Three uses meet the canonical-pattern threshold. Per `components.md` and per `frontend-handoff/design-system/proposals/`, this is now a strong candidate for `<TwoPaneWorkspace>` in `@/design-system/patterns`. Suggested shape:

```tsx
<TwoPaneWorkspace
  rail={<NodesRail ... />}
  main={<NodeDetail ... />}
  railWidth={360}     // 320 for docs/memory; 360 for nodes (more dense rows)
  responsive          // collapse to single column < 1100px
/>
```

Promotion candidate proposed for the next DS proposals batch. Until then, each panel re-invokes the same CSS shell — small duplication, acceptable for now.

## Component reuse cascade

| Molecule         | Origin                | Reused at                                                                                                              |
| ---------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `JsonView`       | NEW (this module)     | api-explorer (response panel), memory dreams (action result), activity (raw event) — strong DS bid                     |
| `ConfirmRow`     | docs (delete confirm) | memory dreams (reset/resetShortTerm), nodes (every mutating action). **3rd use — gate met.** Promote in next DS batch. |
| `PlatformPill`   | NEW                   | agents (device family field), settings (host platform). **Promote** after 2nd use.                                     |
| `StatusDot`      | NEW                   | agents (online/offline), channels (connection state). **Promote** after 2nd use.                                       |
| `CapsCluster`    | NEW                   | api-explorer (handler scopes), agents (capability list). Reusable; eligible for DS.                                    |
| `PermissionGrid` | NEW                   | settings (operator scopes), api-explorer (RBAC view). Eligible after 2nd use.                                          |
| `ActionResult`   | nodes (this module)   | memory dreams (already has equivalent inline). Promotion after refactoring memory dreams to share.                     |
| `RenameForm`     | NEW                   | agents (rename agent), channels (rename channel). Eligible after 2nd use.                                              |

## Tone system across the action surface

Three confirm tones, three result tones — kept consistent with docs and memory:

| Action                                                 | Confirm tone  | Result tone     |
| ------------------------------------------------------ | ------------- | --------------- |
| rename / invoke / pending / approve / request / verify | warn (yellow) | success (green) |
| reject pairing                                         | danger (red)  | success (green) |

Result tone is always success because the BFF returns 4xx/5xx as separate error states, not as "negative result". The verify action is a special case — it can return `status: "invalid"` as a 200, in which case the result heading reads "Token rejected" but the panel still uses success tone (the action itself completed; the verdict was negative). This mirrors how `pair.verify` returns `200` regardless of verdict.

## Notes on benign Babel-standalone diagnostics

The TS diagnostic noise about cross-tag globals (`Could not find name 'IconRefresh'` etc. in `nodes-rail.jsx`, `Property 'NODES' may not exist on type 'Window'` in `data.js` and `app.jsx`) is the standard Babel-standalone pattern — globals are exported via `Object.assign(window, ...)` in `icons.jsx` / inline in `data.js`, and resolved at runtime. They do not affect prototype behavior; the translation step replaces them with real imports.

## Outstanding open questions (carried into Reverse sign-off)

See `README.md#open-questions-for-implementation`. Notable items:

- Polling interval (5s vs 10s vs WS push)
- Typed command schemas (when does `node.commands.describe` ship?)
- Pairing audit log integration with activity feed
- Bulk actions (refresh all, reject all pending)
- Token verify UX (camera scan? clipboard auto-detect?)
- `isRepair` semantic — does the operator distinction matter?
- Pending work payload typing (when does `queued` grow a real shape?)
- Optimistic UI vs pessimistic for approve/reject — depends on Gateway latency

## Codex implementation closeout — 2026-05-04

Implemented under OpenSpec change `frontend-nodes-real-contract-verification`.

### Contract-chain matrix

| Workflow                 | Frontend wrapper                   | BFF route                                  | Gateway method                 | Classification                                                              |
| ------------------------ | ---------------------------------- | ------------------------------------------ | ------------------------------ | --------------------------------------------------------------------------- |
| inventory list           | `fetchNodes()`                     | `GET /api/nodes`                           | `node.list`                    | supported                                                                   |
| selected detail          | `describeNode(nodeId)`             | `POST /api/nodes` action=`describe`        | `node.describe`                | supported                                                                   |
| rename                   | `renameNode(nodeId, displayName)`  | `POST /api/nodes` action=`rename`          | `node.rename`                  | supported, confirm-gated                                                    |
| invoke command           | `invokeNodeCommand(...)`           | `POST /api/nodes` action=`invoke`          | `node.invoke`                  | supported as dynamic envelope, confirm-gated                                |
| pending enqueue          | `enqueueNodePendingWork(...)`      | `POST /api/nodes` action=`pending.enqueue` | `node.pending.enqueue`         | supported as dynamic envelope, confirm-gated                                |
| pairing list             | `fetchNodePairing()`               | `GET /api/nodes/pair`                      | `node.pair.list`               | supported                                                                   |
| pairing request          | `requestNodePairing(input)`        | `POST /api/nodes/pair` action=`request`    | `node.pair.request`            | supported, confirm-gated; body is flattened to match Go typed params        |
| pairing approve          | `approveNodePairing(requestId)`    | `POST /api/nodes/pair` action=`approve`    | `node.pair.approve`            | supported, confirm-gated                                                    |
| pairing reject           | `rejectNodePairing(requestId)`     | `POST /api/nodes/pair` action=`reject`     | `node.pair.reject`             | supported, danger confirm-gated; real E2E uses non-existent request id only |
| pairing verify           | `verifyNodePairing(nodeId, token)` | `POST /api/nodes/pair` action=`verify`     | `node.pair.verify`             | supported, confirm-gated with client-side token length guard                |
| orphan pairing selection | same pairing wrappers              | same pairing route                         | same pairing methods           | supported without `node.describe`                                           |
| BFF-only browser access  | `fetchDeckJson` wrappers           | Deck Go backend only                       | Gateway only behind Go runtime | supported by mock and real browser request checks                           |
| empty/error handling     | panel local state                  | route errors surfaced in panel             | Gateway may return 4xx/5xx     | supported/degraded depending on real Gateway state                          |

### Fixes applied

- Replaced browser-native `window.confirm` with an inline `ConfirmRow` for every mutating action: rename, invoke, pending enqueue, pairing request, approve, reject, and verify.
- Moved `node.invoke` JSON validation before the confirm gate, so invalid params never open a confirmation or call the wrapper.
- Added a 6-character client-side minimum for pairing token verification.
- Default selection now prioritizes the first pending pairing request, matching the v2 workbench state model.
- Expanded the rail KPI strip to nodes / connected / paired / pending and added compact platform/capability pills.
- Fixed the handoff API drift for `node.pair.request`: the live Go BFF and generated Gateway params use flattened fields after `action` is removed, not an `input` wrapper.
- Added API facade regression coverage for flattened `requestNodePairing` payloads.
- Added `nodes-real-gateway.spec.ts` for bounded L2 route-shape and BFF-only UI evidence.

### Verification evidence

- Prototype smoke: `deck-go/frontend-handoff/modules/nodes/prototype.html` loaded through a local static server; title `Nodes — operations workbench`; no browser console/page errors.
- Focused frontend tests: `cd deck-go/frontend-new && npm run test:deck-ui -- src/components/panels/nodes/NodesPanel.test.tsx src/api.chat-helpers.test.ts` passed, 2 files / 55 tests.
- Focused Go tests: `cd deck-go/backend && go test ./internal/server ./internal/runtime/openclaw -run 'TestGatewayFacade_CommandsAndNodesRoutes|TestGatewayQueriesTyped'` passed.
- L1 mock visual E2E: `cd deck-go && pnpm exec playwright test test/e2e/nodes-visual.spec.ts --config playwright.config.ts` passed.
- L2 real Gateway E2E: `cd deck-go && DECK_GO_REAL_GATEWAY_E2E=1 pnpm exec playwright test test/e2e/nodes-real-gateway.spec.ts --config playwright.config.ts` passed, including safe route-shape checks and no direct browser Gateway calls.
- Endpoint classification: `cd deck-go && make endpoint-classification-check` passed.
- Frontend build: `cd deck-go && make frontend-build` passed.
- OpenSpec validation: `openspec validate frontend-nodes-real-contract-verification --strict` passed.
- Whitespace check: `git diff --check` passed.

### Residual risks / handoff

- `node.invoke` and `node.pending.enqueue` now have typed Gateway/Deck outer envelopes; command-specific `payload` leaves remain dynamic until Gateway provides command-specific schemas.
- Real E2E deliberately avoids destructive approve/reject against real pending device state; it uses non-existent IDs for safe action-shape checks.
- Polling/WS refresh, pairing audit feed integration, QR/camera token UX, bulk actions, and generated command forms remain product gaps, not implementation omissions in this change.

## Codex contract completion closeout — 2026-05-05

Implemented under OpenSpec change `deck-go-nodes-command-contract-completion`.

### Contract completion applied

- Confirmed the previous matrix gap was stale: `node.invoke` and `node.pending.enqueue` have typed Gateway params/result outer envelopes in generated TypeScript and Go artifacts.
- Kept `DeckGoNodeInvokeResponse.payload` and `DeckGoNodePendingWorkItem.payload` as documented dynamic leaves in `deck-api-dynamic-surfaces`.
- Added Deck-facing action response DTOs for node rename and pairing approve/reject/verify.
- Added mutation evidence for `nodes.rename`, `nodes.invoke`, `nodes.pending.enqueue`, `nodes.pair.request`, `nodes.pair.approve`, `nodes.pair.reject`, and `nodes.pair.verify`.
- Routed representative Nodes API facades through shared mutation evidence helpers while preserving the browser-to-BFF transport boundary.

### Completion verification evidence

- Contract checks: `cd deck-go && make deck-api-check mutation-evidence-contract-test mutation-evidence-contract-check` passed.
- Dynamic surface sync: `cd deck-go && make deck-api-dynamic-surfaces-sync` refreshed generated dynamic-surface docs for the new action DTOs.
- Focused frontend: `cd deck-go/frontend-new && npm run test:deck-ui -- src/lib/mutation-evidence.test.ts src/api.chat-helpers.test.ts src/components/panels/nodes/NodesPanel.test.tsx` -> 72 tests passed.

### Remaining product gaps

- Command-specific forms still need Gateway command schemas before they can be generated safely.
- Real node rename/invoke/pending/pairing mutations remain skipped-safe without disposable node/device fixtures.
- Pairing audit feed integration, QR/camera token UX, bulk actions, and live refresh remain product follow-ups.

## Prototype parity remediation closeout - 2026-05-06

### Visual and product alignment

- Confirmed `frontend-handoff/modules/nodes/prototype.html` is the active target: two-pane device trust and remote-control workbench with KPI rail, pending pairing, inventory, selected detail, pairing actions, invoke, pending work, and raw/dynamic payload affordances.
- Fixed the deterministic mock fixture density drift: mock Gateway now exposes five prototype-shaped nodes, three connected nodes, four paired nodes, and two pending pairing requests.
- Mock visual evidence now covers Chat -> Nodes shell navigation, dark/en, dark/zh, light/en, light/zh, repair pairing selected state, invoke confirmation/result, pending-work confirmation/result, BFF-only route traffic, and zero unexpected console/page/API errors.

### Real Gateway evidence

- Real E2E verified `/api/runtime/gateway`, `/api/nodes`, `/api/nodes/pair`, describe, invoke, pending enqueue, pair request, approve, reject, and verify route shapes through the Deck BFF.
- Real E2E created a run-scoped pairing request in the isolated real stack, verified it was visible in all four UI variants, exercised the reject confirmation gate and canceled it, then rejected the run-scoped request through the BFF for cleanup.
- Real UI evidence covered Chat -> Nodes navigation, dark/en, dark/zh, light/en, light/zh, BFF-only browser transport, and zero unexpected console/page/API errors.

### Accepted exceptions

- Deck shell chrome and the production "Selected node" heading/description differ from the standalone prototype but preserve the same two-pane operational layout.
- Command-specific invoke forms remain unsupported because Gateway exposes dynamic payload leaves rather than per-command schemas.
- Real rename, invoke side effects, pending enqueue side effects, approve, and verify remain skipped-safe unless a disposable paired device fixture exists.
- Pairing audit feed, QR/camera token UX, bulk actions, and live refresh remain follow-up product contracts.

Code truth remains authoritative over this note. If Gateway node command schemas or disposable node fixtures are added, update the BFF route contracts, dynamic-surface ledger, frontend wrappers, and this matrix before widening Nodes UI claims.

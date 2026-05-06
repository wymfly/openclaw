## 1. Fact Reconfirmation And Guardrails

- [x] 1.1 Reconfirm the explored source facts before implementation: Gateway transcript schemas, Gateway canonicalization, Gateway canvas augmentation, Gateway attachment parsing, deck-go generated Gateway artifacts, Deck-facing DTOs, Go projection, frontend transcript adapter, artifact detection, CanvasPanel/A2UI bridge, and `/chat/projection`.
  - Acceptance: update `proposal.md` or `design.md` if any code fact has drifted before touching implementation.
  - Evidence: context was re-read with `openspec status --change deck-go-content-surface-convergence --json`, `openspec instructions apply --change deck-go-content-surface-convergence --json`, and the listed `proposal.md`, `design.md`, `specs/**/*.md`, and `tasks.md`. Implementation confirmed the proposal facts still matched the code; no proposal/design correction was required.
- [x] 1.2 Add or update focused regression tests before behavior changes for direct canvas, preview-wrapped canvas, unknown transcript fallback, structured `tool_result.content`, image attachment acceptance, generic file rejection/defer behavior, deterministic artifact identity, and A2UI projection round-trip.
  - Acceptance: each test must fail or be meaningfully incomplete against the pre-fix behavior, unless the code is already correct and the task records the existing passing test as evidence.
  - Evidence: focused tests were added/updated in Gateway, Go backend, and frontend; they are covered by the passing commands recorded in sections 2.3, 3.5, and 4.6.
- [x] 1.3 Keep audio/video explicitly out of this change.
  - Acceptance: no `audio` or `video` known transcript renderer/attachment path is introduced; if Gateway emits those blocks, they are handled only by the unknown fallback or existing unrelated code paths.
  - Evidence: `rg -n "type:\s*['\"](?:audio|video)['\"]|\baudio\b|\bvideo\b" src/gateway/protocol/schema/transcript.ts src/gateway/transcript-canonical.ts deck-go/contracts/source/deck-api.contract.ts deck-go/backend/internal/runtime/projection/sessions.go deck-go/backend/internal/server/chat.go deck-go/frontend-new/src/components/panels/chat deck-go/frontend-new/src/stores/chat-types.ts deck-go/frontend-new/src/lib/transcript-adapter.ts` returned no matches.

## 2. OpenClaw Gateway Source Contract

- [x] 2.1 Extend `src/gateway/protocol/schema/transcript.ts` with additive `canvas` and `unknown` transcript block schemas.
  - Acceptance: the known non-audio/video Gateway block set is `text`, `thinking`, `tool_use`, `tool_result`, `image`, `file`, `canvas`, and `unknown`.
  - Evidence: `pnpm test src/gateway/server-methods/chat.transcript-contract.test.ts src/gateway/server-chat.agent-events.test.ts src/gateway/chat-attachments.test.ts` passed with 3 files / 52 tests.
- [x] 2.2 Update `src/gateway/transcript-canonical.ts` so direct canvas blocks, preview-wrapped canvas blocks, unknown blocks, and nested structured `tool_result.content` are preserved instead of silently dropped.
  - Acceptance: canonical output preserves `viewId`, `title`, `preferredHeight`, `url`, `rawType`, and bounded `summary` where applicable.
  - Evidence: same Gateway focused test command passed with canonicalization coverage for direct canvas, preview-wrapped canvas, unknown fallback, and structured tool result content.
- [x] 2.3 Update focused Gateway tests.
  - Acceptance: include coverage in or near `src/gateway/server-methods/chat.transcript-contract.test.ts`, `src/gateway/server-chat.agent-events.test.ts`, and existing attachment/canvas tests where relevant.
  - Evidence: `pnpm test src/gateway/server-methods/chat.transcript-contract.test.ts src/gateway/server-chat.agent-events.test.ts src/gateway/chat-attachments.test.ts` passed with 52 tests.
- [x] 2.4 Regenerate and verify deck-go Gateway protocol artifacts.
  - Acceptance: run `cd deck-go && make protocol-update`, then `cd deck-go && make protocol-check`; generated artifacts are not hand-edited.
  - Evidence: `make protocol-update` was run from `deck-go/` during implementation, and final `make protocol-check` passed.

## 3. Deck-facing Contracts And Go BFF Adaptation

- [x] 3.1 Update Deck-facing contract sources only when the product DTO needs explicit fields for attachments, projection, canvas, unknown, or artifact view metadata.
  - Acceptance: if changed, run `cd deck-go && make contracts-sync` and `cd deck-go && make contract-gate`; generated Deck DTOs are not hand-edited.
  - Evidence: `make contracts-sync` and report sync targets were run from `deck-go/`; final `make contract-gate` passed.
- [x] 3.2 Update Go projection normalization in `deck-go/backend/internal/runtime/projection/sessions.go`.
  - Acceptance: Go projection accepts direct and preview-wrapped canvas, emits the direct Deck canvas shape, recursively normalizes structured tool result content, and emits unknown fallback blocks for unrecognized non-audio/video blocks.
  - Evidence: `go test ./internal/runtime/projection ./internal/runtime/openclaw ./internal/server ./internal/api/http` passed from `deck-go/backend`.
- [x] 3.3 Implement real `/api/chat/projection` persistence for sanitized A2UI/canvas state and merge it into `/api/chat/snapshot`.
  - Acceptance: a backend test posts projection state for a `sessionKey` and later receives the same contract-owned state from snapshot in the same backend process.
  - Evidence: backend projection route tests passed in `go test ./internal/server -count=1`; browser real-stack evidence `real-projection-create-session-evidence.json` shows create-session, projection POST, and snapshot returning sanitized `a2uiState` while dropping bridge-only fields.
- [x] 3.4 Enforce attachment truth at the Go BFF boundary.
  - Acceptance: image attachments continue to forward to Gateway; unsupported generic file attachments cannot be silently forwarded as model inputs and must produce a visible/typed unsupported response if they reach the backend.
  - Evidence: `go test ./internal/server -count=1` covered image forwarding and generic file 400 behavior; frontend browser evidence `chat-real-generic-file-blocked-visible.png` shows visible generic-file feedback and `chat-real-image-attachment-staged.png` shows image staging.
- [x] 3.5 Update focused Go backend tests.
  - Acceptance: include coverage in or near `deck-go/backend/internal/runtime/projection/sessions_test.go`, `deck-go/backend/internal/server/gateway_routes_test.go`, or `deck-go/backend/internal/api/http/admin_test.go` depending on the touched route.
  - Evidence: `go test ./internal/runtime/projection ./internal/runtime/openclaw ./internal/server ./internal/api/http`, `go test ./internal/server -run TestGatewayFacade_ChannelPatchUsesConfigGetThenConfigPatch -count=1`, `go test ./internal/server -count=1`, and `make backend-test GO_ENV='GOCACHE=/tmp/deck-go-buildcache GOSUMDB=off'` passed. A test harness defect in `TestGatewayFacade_ChannelPatchUsesConfigGetThenConfigPatch` was fixed so the fake Gateway can keep one WebSocket connection alive for `config.get -> config.patch`.

## 4. Frontend Product Surfaces

- [x] 4.1 Align `frontend-new` content types, transcript adapter, and renderer registry with the Deck-facing block set.
  - Acceptance: `text`, `thinking`, `tool_use`, `tool_result`, `image`, `file`, `canvas`, and `unknown` each have explicit rendering, and user text never renders as serialized Gateway metadata JSON.
  - Evidence: `npm run test:deck-ui -- src/components/panels/chat/__tests__/history-normalize.test.ts src/components/panels/chat/__tests__/message-list.transcript-rendering.test.tsx src/components/panels/chat/__tests__/block-filter-rendering.test.ts src/components/panels/chat/__tests__/message-input.attachments.test.tsx src/components/panels/chat/artifacts/__tests__/detectArtifact-enhanced.test.ts src/components/panels/chat/__tests__/canvas-panel.test.tsx` passed with 6 files / 55 tests.
- [x] 4.2 Converge structured tool result rendering and artifacts.
  - Acceptance: tool results default to collapsed detail where appropriate, nested blocks render through block-aware renderers, artifact-capable content exposes an inline entry point, raw output remains available, and artifact IDs are deterministic for the same transcript.
  - Evidence: same focused frontend command passed; browser evidence `chat-rich-content-light-structured.png`, `chat-rich-content-light-structured-expanded.png`, `chat-rich-structured-collapsed.yml`, and `chat-rich-dom-evidence.json` captured collapsed/expanded structured result and deterministic artifact entry points.
- [x] 4.3 Converge upload UX with Gateway capability.
  - Acceptance: the composer uses a standard upload icon, image attachments can be sent, oversize images are rejected, and generic files are either visibly blocked or explicitly staged as non-model-input product artifacts.
  - Evidence: focused frontend attachments tests passed; browser evidence `chat-real-generic-file-blocked-visible.png` and `chat-real-image-attachment-staged.png` covers real-page generic-file blocking and image attachment staging.
- [x] 4.4 Converge inline canvas and A2UI drawer behavior.
  - Acceptance: transcript canvas blocks render inline; relative canvas URLs route through `/api/canvas/*`; bridge ready/action/surface/tree/eval/reset/push flows remain wired; projection save/restore is visible after refresh/snapshot.
  - Evidence: frontend canvas tests passed; browser evidence `chat-rich-current-after-canvas-fix.yml`, `chat-rich-current-after-canvas-fix.png`, and `real-canvas-proxy-evidence-after-fix.json` show inline/drawer content and real `/api/canvas/index.html` returning 200 with bridge content through the Go BFF.
- [x] 4.5 Update i18n and design-system usage for all newly visible states.
  - Acceptance: visible copy exists in EN/ZH, light/dark mode remains coherent, production UI does not add ad hoc inline styling for the new surfaces.
  - Evidence: EN/ZH browser captures exist as `chat-rich-content-en-light-mode.png`, `chat-rich-content-en-dark-mode.png`, and `chat-rich-content-light-mode.png`; `make frontend-build` passed.
- [x] 4.6 Update focused frontend tests.
  - Acceptance: run focused tests covering `history-normalize`, `message-list.transcript-rendering`, `block-filter-rendering`, `message-input.attachments`, artifact detection/panel behavior, and canvas panel/bridge behavior.
  - Evidence: focused `npm run test:deck-ui -- ...` command passed with 55 tests; `make frontend-build` passed.

## 5. Mock Visual And Real Gateway Verification

- [x] 5.1 Add or update mock fixtures for rich chat content.
  - Acceptance: mock coverage includes text, thinking, tool use, tool result, nested tool result content, image, file, inline canvas, unknown fallback, artifact-capable results, image upload, unsupported generic file upload, and A2UI drawer state.
  - Evidence: `deckVisualState=chat-rich` was updated and captured in `chat-rich-dom-evidence.json`, `chat-rich-current-after-canvas-fix.yml`, and `chat-rich-current-after-canvas-fix.png`.
- [x] 5.2 Run mock visual/browser verification in `frontend-new`.
  - Acceptance: capture or record Playwright evidence for chat content surfaces in EN/ZH and light/dark modes; verify navigation to Chat and the affected sub-surfaces is interactive.
  - Evidence: Playwright evidence files include `chat-rich-visual-snapshot.yml`, `chat-rich-current-after-canvas-fix.yml`, `chat-rich-current-after-canvas-fix.png`, `chat-rich-content-en-light-mode.png`, `chat-rich-content-en-dark-mode.png`, and `chat-rich-content-light-mode.png`.
- [x] 5.3 Run bounded real Gateway verification using the isolated real-stack environment.
  - Acceptance: attempt up to 2 environment-level runs through `deck-go/scripts/dev/run-stack-real.sh` with the isolated config/workspace; verify image attachment, generic file unsupported behavior, artifact-capable tool output, canvas URL rendering where possible, and no raw JSON leakage in history reload.
  - Evidence: `DECK_GO_STACK_ENV=.local/deck-go-real-stack/env-isolated-real-e2e scripts/dev/run-stack-real.sh status` showed Gateway, backend, and frontend running on ports 18789, 19566, and 4174. Browser evidence: `real-projection-create-session-evidence.json`, `real-canvas-proxy-evidence-after-fix.json`, `chat-real-generic-file-blocked-visible.png`, and `chat-real-image-attachment-staged.png`.
- [x] 5.4 Apply the circuit breaker only to environment-dependent real checks.
  - Acceptance: if real Gateway cannot be completed after 2 narrowed attempts, record exact commands/logs/root cause in `tasks.md` or a linked handoff note; unit, contract, backend, frontend, and mock visual checks still must pass before completion.
  - Evidence: no real-stack circuit breaker was needed after fixing bundled runtime token fallback for `/api/canvas/*`. Earlier manual relative `/api/chat/projection` browser fetches returned 404 because they bypassed the app's configured `VITE_DECK_GO_API_BASE`; absolute backend checks and app-path evidence passed.

## 6. Final Validation And Archive Readiness

- [x] 6.1 Run OpenSpec validation.
  - Acceptance: `openspec validate --type change deck-go-content-surface-convergence --strict` passes.
  - Evidence: `openspec validate --type change deck-go-content-surface-convergence --strict` passed.
- [x] 6.2 Run contract validation.
  - Acceptance: `cd deck-go && make protocol-check` and `cd deck-go && make contract-gate` pass after all generated artifacts are up to date.
  - Evidence: `make protocol-check` and `make contract-gate` passed from `deck-go/`.
- [x] 6.3 Run backend validation.
  - Acceptance: run focused Go tests for touched packages and `cd deck-go && make backend-test`, unless a clearly unrelated pre-existing failure is documented.
  - Evidence: focused Go tests passed; `make backend-test GO_ENV='GOCACHE=/tmp/deck-go-buildcache GOSUMDB=off'` passed. The exact default `make backend-test` target first failed because it forces an empty `GOMODCACHE=/tmp/deck-go-gomodcache`, causing existing module imports such as `github.com/go-chi/chi/v5` and `github.com/gorilla/websocket` to be unresolved; the successful override preserves the normal module cache while keeping the build cache isolated.
- [x] 6.4 Run frontend validation.
  - Acceptance: run focused `npm run test:deck-ui -- ...` tests in `deck-go/frontend-new` and `cd deck-go && make frontend-build`.
  - Evidence: focused `npm run test:deck-ui -- ...` passed with 55 tests; `make frontend-build` passed.
- [x] 6.5 Run focused Gateway validation.
  - Acceptance: run focused `pnpm test` targets for touched Gateway transcript, canvas, event, and attachment tests.
  - Evidence: `pnpm test src/gateway/server-methods/chat.transcript-contract.test.ts src/gateway/server-chat.agent-events.test.ts src/gateway/chat-attachments.test.ts` passed with 52 tests.
- [x] 6.6 Record evidence next to completed tasks.
  - Acceptance: every checked task includes the relevant command or browser evidence; unresolved product or Gateway questions are documented as follow-up, not hidden.
  - Evidence: this file records command and browser evidence under every completed task.
- [x] 6.7 Confirm archive readiness.
  - Acceptance: OpenSpec validation passes, all mandatory task evidence is recorded, real Gateway circuit-breaker status is explicit, and no known implementation task remains unchecked.
  - Evidence: all tasks are checked, `openspec validate --type change deck-go-content-surface-convergence --strict` passed, and no environment circuit breaker remains open.

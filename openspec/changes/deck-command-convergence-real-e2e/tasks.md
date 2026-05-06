## 1. Command Inventory And Classification

- [x] 1.1 Generate the Chat command convergence matrix from `LOCAL_COMMAND_DEFS`, the frontend command registry, `deck.commands.discover`, and existing Chat/Sessions BFF routes.
- [x] 1.2 Classify every visible command or command family by source, aliases, argument shape, execution path, mutation safety, frontend expected state, output renderer, and evidence status.
- [x] 1.3 Record all local-vs-Gateway name collisions and document the source-priority/shadowing rationale for each collision.
- [x] 1.4 Identify unsafe commands and record skipped-safe, degraded, or handoff-blocked real-E2E policy before any real execution attempt.

## 2. Contract And Backend Execution Path Convergence

- [x] 2.1 Audit command discovery metadata and fix contract-backed alias/category/argument propagation where Gateway or Deck already provides truth.
- [x] 2.2 Audit local command handlers and Deck BFF routes to ensure each matrix row points to the correct execution authority.
- [x] 2.3 Verify command-backed Chat/Sessions mutations use centralized frontend facades and contract-backed DTOs rather than ad hoc route strings in production components.
- [x] 2.4 Add backend or facade tests for command-backed mutations that need server-side proof, including compact, reset, clear, patch, abort, and send where applicable.

## 3. Frontend Command Parser, Registry, And Input State

- [x] 3.1 Add or update tests for command parsing, alias resolution, source priority, qualified lookup, unknown-command rejection, and remote/manual command dispatch.
- [x] 3.2 Fix deterministic parser/registry/executor gaps found by the tests without broad speculative rewrites.
- [x] 3.3 Verify palette, tag mode, and argument-options mode close or transition cleanly after dispatch, cancellation, and rejection.
- [x] 3.4 Verify manual typed remote commands are sent through the remote path and are not misclassified as unknown commands or plain chat text.

## 4. Command UI State Convergence

- [x] 4.1 Define the UI state model for each command class: instant local update, query result, remote reply, mutation pending/running/completed/failed, approval-gated, or unsupported.
- [x] 4.2 Implement durable frontend state feedback for local configuration commands and verify context-bar/session-meta updates without page reload.
- [x] 4.3 Implement mutation progress feedback for long-running commands, using `/compact` as the reference pattern.
- [x] 4.4 For `/compact`, prove the correct OpenClaw-backed compaction path is called, the UI shows compaction running, and final compaction/checkpoint/session state or failure state is visible.
- [x] 4.5 Ensure optimistic state is rolled back or corrected on command failure, especially for stop, compact, reset, clear, and patch commands.

## 5. Command Output Rendering

- [x] 5.1 Define output renderer classes for OpenClaw status reports, command errors, mutation progress/results, tool calls/results, and normal assistant prose.
- [x] 5.2 Add or update transcript renderer tests so status-like OpenClaw outputs render as structured status cards rather than raw text.
- [x] 5.3 Verify tool calls and tool results remain collapsed by default and are not regressed by command output handling.
- [x] 5.4 Verify normal assistant Markdown replies continue to render through the standard Markdown renderer.

## 6. Representative Real Gateway E2E

- [x] 6.1 Prepare or reuse the isolated real Gateway stack with copied OpenClaw config/workspace and `cpa` + `main` seed.
- [x] 6.2 Add real E2E coverage for safe representative command classes: local config, local query, local mutation, Gateway builtin, alias, unknown command, and skill/plugin discovery or dispatch when safe.
- [x] 6.3 Add bounded retry/circuit-breaker handling so environment failures produce handoff-blocked evidence instead of blocking unrelated command work indefinitely.
- [x] 6.4 Persist redacted command evidence with command name, source class, expected backend path, UI assertion, response summary, final status, and blocker reason when applicable.
- [x] 6.5 Run a Playwright browser verification pass against the live frontend and record the tested URL, selected session, sampled commands, and UI assertions.

## 7. Acceptance Matrix Closure

- [x] 7.1 Update the command convergence matrix rows with final evidence status after unit, UI, backend, and real E2E verification.
- [x] 7.2 Mark rows complete only when both backend/OpenClaw execution-path evidence and frontend UI-state/rendering evidence are present.
- [x] 7.3 Record unresolved Gateway metadata gaps, unsafe command handoffs, or product-design decisions as explicit handoff items.
- [x] 7.4 Confirm no visible command remains in an undocumented state: every command must be complete, skipped-safe, degraded, or handoff-blocked.

## 8. Verification

- [x] 8.1 Run targeted frontend command tests covering parser/registry/executor/input/rendering behavior.
- [x] 8.2 Run backend/facade tests for touched Chat/Sessions command mutation routes.
- [x] 8.3 Run `cd deck-go && make frontend-build` or the narrow equivalent after frontend changes.
- [x] 8.4 Run `openspec validate deck-command-convergence-real-e2e --strict` and fix validation issues.
- [x] 8.5 Produce a final implementation report that lists completed command classes, real E2E evidence, skipped-safe/handoff-blocked commands, and remaining risks.

## Context

Deck Chat commands are no longer a purely frontend slash menu. The visible command surface now spans:

- frontend-local commands such as model/thinking/usage display changes;
- Deck BFF chat/session mutations such as reset, clear, compact, patch, abort, and send;
- Gateway-discovered builtin commands such as `/status`;
- Gateway skills and plugin commands;
- aliases inherited from OpenClaw command metadata;
- command outputs that can be normal text, status reports, errors, tool activity, or mutation progress.

The current implementation has enough infrastructure to prove representative paths, but acceptance has been inconsistent. A command can appear to work while still missing an alias, using the wrong execution path, hiding in-flight state, duplicating output, or rendering a structured OpenClaw response as unfriendly raw text. The implementation standard must therefore cover the whole loop: command discovery/selection, backend execution, event/state projection, frontend UI feedback, and real E2E evidence.

## Goals / Non-Goals

**Goals:**

- Create a command convergence matrix that is the working inventory for every visible Chat command.
- Make command execution authority explicit: frontend-local, Deck BFF, Gateway builtin, skill, or plugin.
- Require backend/OpenClaw correctness and frontend UI correctness for a command to be marked complete.
- Require command-specific state feedback for long-running or mutating commands. `/compact` is the reference pattern: execution starts through the correct OpenClaw path, UI shows compaction in progress, completion clears the running state, and resulting session/checkpoint metadata is visible.
- Define a class-based real E2E strategy with bounded attempts and redacted evidence.
- Preserve safety: commands with destructive, shell, filesystem, credential, or external side effects are reviewed and classified, not blindly real-executed.

**Non-Goals:**

- This change does not add new upstream OpenClaw commands.
- This change does not require real execution of every dangerous command.
- This change does not redesign the entire Chat visual layout beyond command-specific output and state presentation.
- This change does not replace Gateway as command truth; Deck may adapt commands into product UI, but must trace behavior back to Gateway/Deck contract truth.

## Decisions

### Decision 1: Maintain a command convergence matrix

Create a machine-readable or Markdown-backed matrix under the deck-go contract/evidence area that records one row per visible command or command family.

Each row records:

- command name and aliases;
- source (`local`, `builtin`, `skill`, `plugin`);
- discovery authority (`LOCAL_COMMAND_DEFS`, `deck.commands.discover`, or generated metadata);
- argument shape (`none`, `enum`, `freeform`, `multi-step`, `structured`);
- execution path (`frontend-only`, `Deck BFF route`, `Gateway remote command`, `skill/plugin remote command`);
- mutation/safety class;
- expected frontend state before/during/after execution;
- output renderer class;
- unit/UI/backend/real-E2E evidence status;
- skip-safe or handoff-blocked reason when real execution is not appropriate.

Rationale: without a row-level inventory, command support will drift again as new upstream commands, aliases, and UI affordances are added.

Rejected alternative: rely on manual testing notes only. This does not scale and cannot prove source priority, aliases, or safety decisions.

### Decision 2: Treat command execution as a state machine

Every executable command is classified into one of these frontend state models:

- instant local state update;
- local status/query result;
- remote command send with assistant output;
- mutation with visible pending/running/completed/failed states;
- command requiring user approval or external safety gating;
- unsupported/handoff-blocked command.

Rationale: commands such as `/compact` and `/stop` are not equivalent to `/status`. They need visible pending/running/final states and must not be marked complete simply because a request returned 200.

Rejected alternative: use only toast messages. Toasts are useful confirmation, but they disappear and do not communicate durable state such as active compaction or updated checkpoint counts.

### Decision 3: Gateway command metadata must be preserved where possible

Deck command discovery should retain Gateway command aliases, descriptions, categories, argument hints, and safety metadata when Gateway exposes them. If Gateway does not expose enough metadata, Deck must either:

- add a contract-backed adapter layer based on currently available Gateway truth; or
- record the gap as handoff-blocked instead of silently hardcoding broad behavior.

Rationale: alias and argument drift is a primary source of command failure. Local patches are acceptable for confirmed urgent gaps, but the long-term source must be the command contract chain.

Rejected alternative: keep frontend-only alias lists for all commands. This is brittle and will diverge from OpenClaw.

### Decision 4: Output rendering is part of command correctness

Command completion requires output to be rendered with an appropriate component:

- OpenClaw status reports use structured status cards;
- command errors use error treatments with actionable text;
- command progress uses persistent in-panel status, not only a toast;
- tool calls/results use collapsed tool cards by default;
- normal LLM replies continue through Markdown rendering.

Rationale: a command that executes correctly but produces unreadable UI is not complete for an enterprise control product.

### Decision 5: Real E2E is representative and safety-bounded

Real E2E runs against the isolated real Gateway stack and `cpa` + `main` seed. It must cover representatives of command classes rather than every command. Unsafe commands must still have code-level evidence, contract mapping, and explicit skip/handoff records.

Rationale: this gives practical confidence without risking operator state or destructive side effects.

## Risks / Trade-offs

- [Risk] Gateway may not expose aliases or argument metadata for all commands. → Mitigation: implement what is contract-backed, record missing metadata as a Gateway contract gap, and avoid silent broad frontend hardcoding.
- [Risk] Real E2E may fail because the local isolated Gateway, cpa credentials, or workspace fixture is unavailable. → Mitigation: use bounded attempts, record redacted blocker evidence, and continue with code-level verification.
- [Risk] Long-running command UI state can get stuck if SSE events are missed. → Mitigation: combine event projection with read-after-write reconciliation where the contract supports it.
- [Risk] Some commands can mutate filesystem, sessions, credentials, or external services. → Mitigation: classify them as unsafe unless a disposable fixture and cleanup are proven.
- [Risk] Adding command-specific renderers could fragment Chat rendering. → Mitigation: route by output class and keep renderers under the existing transcript block system.

## Migration Plan

1. Build the command matrix from local command definitions, Gateway discovery, and existing Chat/Sessions BFF routes.
2. Classify commands by source, argument shape, execution path, safety, UI state, and output renderer.
3. Fix deterministic registry/parser/executor gaps first: aliases, source priority, unknown command handling, remote/manual send behavior, and argument modes.
4. Implement stateful command UI for mutation commands, starting with `/compact` as the reference pattern.
5. Add output renderers for command outputs where raw text is not acceptable.
6. Add unit/UI/backend tests for each command class.
7. Run real E2E representative samples with bounded retries and persist redacted evidence.
8. Mark matrix rows complete only when both backend execution evidence and frontend UI evidence meet the acceptance rules.

Rollback is local to the frontend/BFF changes: command matrix and tests can remain as diagnostics while individual UI adapters or renderers are reverted if they regress Chat behavior.

## Open Questions

- Which Gateway command metadata fields can be made canonical without upstream changes: aliases, argument schema, safety classification, output type, or category?
- Should high-risk Gateway commands be hidden by default in Deck UI, shown with disabled/handoff labels, or shown as remote text commands with explicit warnings?
- Should command output type be inferred from text, returned through Deck BFF metadata, or attached to Gateway command responses in a future upstream contract?

## Context

`deck-go/frontend-handoff/modules/sessions/` contains a complete single-file
high-fidelity prototype plus components/states/interactions/api usage handoff.
The production `frontend-new` Sessions panel already implements a dense
operations workbench and consumes BFF wrappers for session inventory, previews,
detail, chat history, usage/context, compaction checkpoints, subagent lineage,
session mutations, transcript cache, and client-side export.

Current verified contract facts:

- Browser code must call only deck-go backend routes.
- Session inventory uses `GET /sessions` through `fetchSessions`; `GET
/chat/sessions` remains an alias.
- Session previews use `POST /chat/sessions/preview`.
- Session detail uses `GET /sessions/{sessionKey}`.
- Transcript history uses `GET /chat/history` and the shared transcript cache.
- Usage/context uses `GET /usage/sessions` and `GET /usage/sessions/logs`.
- Subagent lineage uses `POST /deck/subagents` with `action: "lineage"`.
- Session mutations use `POST /chat/sessions/reset`, `POST
/chat/sessions/clear`, `DELETE /chat/sessions`, `POST
/chat/sessions/patch`, `POST /chat/compact`, and `POST /chat/compaction`.
- The current UI metadata `sessions-chat` domain only covers a smaller chat
  subset, so Sessions-specific metadata coverage must be audited and fixed if
  confirmed.

## Goals / Non-Goals

**Goals:**

- Audit Sessions against the full BFF/DTO/frontend/mock/E2E contract chain.
- Fix deterministic Sessions-scoped drift directly when behavior and source
  ownership are clear.
- Preserve the production Sessions workbench and only refactor UI where
  contract-backed drift or obvious quality issues are found.
- Add bounded L2 real-stack evidence for safe session read paths, usage,
  compaction/lineage availability, skipped-safe destructive mutation boundaries,
  and BFF-only browser access.
- Record workflow classifications and residual risks in
  `frontend-handoff/modules/sessions/implementation-notes.md`.
- Keep OpenSpec tasks, verification evidence, and archive readiness in sync.

**Non-Goals:**

- No broad rewrite of the existing Sessions UI solely because the handoff is a
  prototype.
- No real destructive session mutation in L2 unless a controlled fixture session
  and operator-state safety can be proven.
- No new server-side pagination/cursor contract.
- No exhaustive schema-driven session patch editor beyond current typed fields.
- No new dependencies or broad design-system atom promotion.
- No direct Gateway calls from browser code.

## Decisions

1. **Use production code plus contracts as authority and the handoff as visual
   target.**
   The current Sessions panel already implements most target workflows. The pass
   should keep useful behavior and close contract/metadata/evidence gaps.

2. **Separate read verification from mutation safety.**
   Real E2E should verify safe read and UI boundaries first. Reset, clear,
   delete, compact, patch, branch, and restore are skipped-safe unless a
   disposable session can be created and cleaned up without disturbing operator
   state.

3. **Correct UI metadata rather than relying on panel readiness text.**
   The contract chain should list actual Sessions DTOs, endpoints, and actions
   used by the production panel, including preview/detail/history/usage,
   compaction, lineage, and mutation controls.

4. **Treat optional Gateway data as empty-valid or degraded.**
   Real Gateway may expose no sessions, no compaction checkpoints, no usage
   rows, or unsupported lineage for selected sessions. These states are valid
   when route shapes and UI behavior remain correct.

5. **Fix deterministic drift during the audit.**
   Clear mismatches in wrappers, endpoint classification, UI metadata, mocks,
   handoff docs, tests, or local validation should be fixed in the source-owned
   layer with focused evidence.

## Risks / Trade-offs

- **Real Gateway session data may be empty** -> Treat empty lists/history/usage
  as empty-valid while keeping route shape and UI render checks strict.
- **Session mutations can delete or rewrite operator history** -> Skip real
  destructive mutation unless a controlled disposable session exists.
- **Compaction and lineage can be method-dependent** -> Classify unsupported
  400/404/501/502/503 responses as degraded when the BFF route shape remains
  intact.
- **UI metadata expansion can affect generated docs broadly** -> Change only
  source metadata and run `make ui-metadata-check` / `make contract-gate`.

## Open Questions

- Whether session inventory needs a server-side cursor/pagination contract.
- Whether compaction action result DTOs should be stricter than the current
  action envelope.
- Whether Sessions should own lineage long-term or deep-link more strongly into
  Subagents for relationship-heavy workflows.
- Whether transcript export should become a shared pattern after another module
  repeats it.

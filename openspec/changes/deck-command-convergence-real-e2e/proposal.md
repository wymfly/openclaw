## Why

Deck Chat command support has grown from a small local slash palette into a mixed control surface that includes local UI commands, Deck BFF mutations, Gateway-discovered builtins, skills, and plugins. Recent real E2E work showed that “command appears in the UI” is not enough: every implemented command must prove that OpenClaw executes the intended action through the correct backend path and that the frontend presents the correct in-flight and post-action state.

## What Changes

- Establish a command convergence matrix for every visible Chat command, covering source (`local`, `builtin`, `skill`, `plugin`), aliases, argument shape, backend execution path, mutation safety, frontend state expectations, output renderer, and verification evidence.
- Require every implemented command to converge across both sides of the control loop:
  - backend/OpenClaw execution semantics are correct and contract-backed;
  - frontend UI state is correct before, during, and after execution.
- Require commands with visible runtime state to expose precise UI feedback. For example, `/compact` must not only call the correct OpenClaw compaction path; the Chat UI must show that compaction is running, update/hide that state when it finishes, and reflect resulting compaction/checkpoint/session metadata.
- Replace ad hoc command acceptance with strict class-based verification:
  - local config commands;
  - local status/query commands;
  - session/chat mutation commands;
  - Gateway-discovered builtin commands;
  - skill/plugin commands;
  - alias commands;
  - unknown/unsupported commands;
  - high-risk commands that must be skipped-safe or handoff-blocked.
- Require real Gateway E2E for safe representative commands, with a bounded retry/circuit-breaker policy and redacted evidence. Unsafe/destructive commands must still receive code-level review, contract mapping, and explicit skip/handoff evidence.
- Improve command output presentation by type rather than by raw text only. Status-like OpenClaw outputs, mutation progress, tool outputs, errors, and normal assistant replies must have appropriate UI renderers and tests.

## Capabilities

### New Capabilities

- `deck-command-convergence-real-e2e`: Defines the project-wide Chat command convergence matrix, implementation discipline, and real E2E acceptance standard for all command classes.

### Modified Capabilities

- `chat-slash-commands`: Strengthen slash command behavior from palette/execution basics to complete local/remote/alias/source-priority/argument/output/UI-state convergence.
- `deck-go-sessions-chat-contract-completion`: Extend Chat/Sessions contract completion to include command-driven session/chat mutations such as compact, reset, clear, patch, stop, and send.
- `deck-go-real-e2e-seed-and-evidence`: Extend real Gateway evidence expectations to include representative command-class verification and bounded skip/handoff evidence for unsafe commands.

## Impact

- **Contracts/specs**: Command matrix source and generated documentation under `deck-go/contracts/` or a dedicated frontend verification artifact; updates to Chat command and real E2E specs.
- **Backend/BFF**: Command discovery, alias metadata, command execution routes, chat/session mutation routes, compaction/abort/patch/send paths, and status/progress event streams.
- **Frontend**: `frontend-new` Chat command registry, parser, palette, argument/tag modes, command executor, session context bar, transcript renderers, command-specific progress/status UI, and i18n.
- **Testing/Evidence**: Unit tests for parser/registry/executor; UI tests for palette/input/state renderers; backend tests for command-backed mutations; real Gateway Playwright or scripted E2E with redacted evidence and skip-safe records.
- **Risk management**: Commands with filesystem, process, shell, credential, destructive session, or external side effects must not be blindly real-executed. They require explicit safety classification, controlled fixtures, or handoff-blocked evidence.

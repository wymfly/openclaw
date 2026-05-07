# Chat Command E2E Investigation Guide

This file is the quick-location guide for future Chat slash-command E2E issues.
It is an investigation map, not the source of truth. When this file disagrees
with code, contracts, generated artifacts, OpenSpec tasks, or live test output,
use those sources as truth and update this file if the mismatch is durable.

## Start Here

Read these in order when the user reports a command E2E problem:

1. `deck-go/docs/chat-command-convergence-matrix.md`
2. `deck-go/docs/chat-command-convergence-implementation-report.md`
3. `deck-go/docs/evidence/chat-command-real-e2e/no-run-id-chat-command-real-convergence.json`
4. The current source files listed below

Do not start by running every command through scripted E2E. For user-reported
issues, first classify the command and inspect the code path, then verify one or
two representative cases in the visible browser against the isolated real stack.

## Command Contract Chain

Command behavior crosses five layers:

| Layer                       | Source files                                                                                                                                                                                          | What to verify                                                                                                   |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| OpenClaw builtin truth      | `src/auto-reply/commands-registry.shared.ts`                                                                                                                                                          | Builtin command names, aliases, categories, scopes, and side-effect risk.                                        |
| Gateway discovery API       | `src/gateway/server-methods/deck/commands.ts`, `src/gateway/server-methods/deck/commands.test.ts`                                                                                                     | `deck.commands.discover` exposes builtin, skill, and plugin command metadata correctly.                          |
| Generated Gateway protocol  | `deck-go/contracts/generated/ts/gateway/protocol.ts`, `deck-go/backend/internal/gateway/generated/`                                                                                                   | Generated artifacts match Gateway protocol authority. Do not hand-edit generated files.                          |
| Deck Go BFF                 | `deck-go/backend/internal/server/chat.go`, `deck-go/backend/internal/server/inventory.go`                                                                                                             | Browser calls stay behind Deck endpoints; local product commands use typed BFF/facade routes where needed.       |
| Frontend command product UI | `deck-go/frontend-new/src/components/panels/chat/`, `deck-go/frontend-new/src/lib/command-registry.ts`, `deck-go/frontend-new/src/hooks/use-command-discovery.ts`, `deck-go/frontend-new/src/stores/` | Palette visibility, parser routing, execution state, session metadata, transcript rendering, and error rollback. |

## First Classification

Classify the command before debugging:

| Type                    | Examples                                                                                         | Expected route                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Local product command   | `/new`, `/reset`, `/compact`, `/usage`, `/t`, `/model`, `/agents`                                | Frontend registry -> Deck BFF -> Gateway/facade when needed.                               |
| Gateway builtin command | `/status`, `/id`, `/commands`, `/tools`, `/models`                                               | Gateway discovery -> frontend registry -> normal chat send to Gateway.                     |
| Shadowed builtin        | `/compact`, `/new`, `/reset`, `/usage`, `/think`, `/export`                                      | Deck local command intentionally wins over Gateway builtin/alias. Check `SOURCE_PRIORITY`. |
| Skill/plugin command    | dynamic commands from discovery                                                                  | Palette/manual command -> Gateway command path only after a harmless fixture is selected.  |
| Unsafe command          | `/bash`, `/restart`, `/kill`, write modes of `/config`, `/mcp`, `/plugins`, `/exec`, `/elevated` | Do not real-run unless a disposable fixture and side-effect boundary are explicit.         |

## Fast Symptom Routing

Use this table to jump to the likely source quickly:

| Symptom                                                      | Inspect first                                                                                                                                   |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Command is missing from the palette                          | `use-command-discovery.ts`, `command-registry.ts`, `SlashCommandPalette.tsx`, `deck.commands.discover` response.                                |
| Command is sent as plain chat text                           | `parseSlashCommand()` in `slash-commands.ts`, `MessageInput.tsx`, `command-registry.ts`, source priority/collision handling.                    |
| Alias does not work                                          | `LOCAL_COMMAND_DEFS` in `slash-commands.ts`, Gateway aliases in `commands-registry.shared.ts`, `command-registry.test.ts`.                      |
| Local config command claims success but UI is stale          | `slash-command-executor.ts`, `ChatContextBar.tsx`, `chat.ts`, session patch/reload path, optimistic update rollback tests.                      |
| `/compact` state is wrong                                    | `slash-command-executor.ts`, `MessageInput.tsx`, `ChatContextBar.tsx`, `chat.ts`, `POST /api/chat/compact`, compaction metadata reconciliation. |
| Gateway output duplicates assistant messages                 | `stores/chat-dispatchers.ts`, `hooks/useChatSSE.ts`, history reload/deduplication, transcript normalization.                                    |
| Gateway output renders as raw text                           | `TranscriptBlocks.tsx`, `OpenClawStatusCard.tsx`, transcript adapter/normalizer files, Markdown renderer.                                       |
| Tool use or tool result is expanded by default               | `ToolUseCard.tsx`, `ToolResultCard.tsx`, transcript block state defaults.                                                                       |
| Historical user messages render as JSON                      | chat API normalization, transcript adapter, message history loaders, store hydration path.                                                      |
| Real stack shows connected and reconnecting at the same time | backend Gateway status source vs Chat SSE stream source; inspect header connection state separately from `useChatSSE.ts`.                       |

## Real E2E Rules

Use the isolated real stack for real verification. The intended fixture is a
copy of the user's global OpenClaw config and workspace, adjusted to disposable
test paths. The default real model/channel assumption is `cpa` + `main`.

Default stack command from repo root:

```bash
cd deck-go
DECK_GO_STACK_ENV=.local/deck-go-real-stack/env-isolated-real-e2e scripts/dev/run-stack-real.sh restart
```

Important operational notes:

- Prefer the real-stack script over ad hoc Gateway startup.
- Avoid `pnpm openclaw gateway run` for this workflow. The maintained real-stack
  path starts Gateway with `node dist/entry.js gateway run ...` so it does not
  enter `scripts/run-node.mjs` dirty-tree rebuilds or runtime-postbuild
  dependency staging during interactive E2E.
- Use Vite dev mode for visual debugging so frontend fixes hot reload.
- Keep the browser page open during collaborative E2E; refresh the same page
  after hot updates instead of closing the user's browser.
- Create or mutate only disposable sessions/workspaces during real E2E.
- Treat broad scripted all-command E2E as auxiliary. It is not the first tool
  for user-reported visual or interaction bugs.

## Representative Verification

Pick the narrowest relevant checks. Useful commands:

```bash
pnpm test src/gateway/server-methods/deck/commands.test.ts
```

```bash
cd deck-go
make protocol-check
```

```bash
cd deck-go
make frontend-build
```

```bash
cd deck-go/frontend-new
npm run test:deck-ui -- \
  src/components/panels/chat/__tests__/slash-commands.test.ts \
  src/lib/command-registry.test.ts \
  src/hooks/use-command-discovery.test.tsx \
  src/components/panels/chat/__tests__/slash-command-executor.test.ts \
  src/components/panels/chat/__tests__/message-input.remote-command.test.tsx \
  src/components/panels/chat/__tests__/chat-context-bar.test.ts
```

Focused backend command-route evidence:

```bash
cd deck-go/backend
go test ./internal/server -run 'TestGatewayFacade_(ChatSendAndCreate|ChatCompactCompactionAndSteer|ChatAbort|SessionPreviewResetClearAndPatch|ChatSessionsListAndDelete)'
```

If an active OpenSpec change governs the fix, validate it before claiming
completion:

```bash
openspec validate <change-id> --strict
```

## Current Known State

As of 2026-05-06, the `deck-command-convergence-real-e2e` work closed the core
code path and representative real verification, with these important caveats:

- `/new`, `/t high`, `/usage status`, and `/compact` have representative
  visible-browser evidence.
- `/status` and `/id` reach the real Gateway and render useful output, but
  duplicate assistant output was observed and remains a degraded UI issue.
- Unknown slash command rejection is covered at code-test level.
- Skill/plugin command discovery is implemented, but dispatch remains
  handoff-blocked until a harmless real fixture is selected.
- Real execution is intentionally skipped for shell/process/runtime/security,
  media, and destructive commands unless a disposable fixture is explicit.

## Report Template

When reporting a command E2E bug investigation, include:

- Command and exact input.
- Classification: local product, Gateway builtin, shadowed builtin,
  skill/plugin, or unsafe.
- Expected route through the contract chain.
- Actual failing layer with file references.
- Whether the issue is code truth, contract drift, UI rendering, test fixture,
  or environment.
- Verification performed: code test, visible browser, real stack, or skipped
  with reason.
- Remaining risk or handoff item.

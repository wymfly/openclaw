# Chat Command Convergence Implementation Report

OpenSpec change: `deck-command-convergence-real-e2e`

Date: 2026-05-06

## Verification Policy Used

The proposal route remains valid: command convergence is judged by contract/path evidence plus frontend UI evidence. For this implementation pass, scripted Playwright E2E is not a hard gate. It is auxiliary evidence only.

Accepted evidence for closure:

- code-level tests for parser, registry, executor, BFF routes, and renderers;
- focused backend/facade tests for command-backed mutations;
- visible Playwright browser verification against the real stack for representative command classes.

## Completed Command Classes

| Class                  | Representative evidence                                                                                                                                                      | Status                                                          |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Local config alias     | `/t high` in visible browser updated the context bar to `推理 高`; unit tests cover aliases and failure rollback.                                                            | complete                                                        |
| Local query            | `/usage status` in visible browser rendered a token/model summary in the transcript.                                                                                         | complete                                                        |
| Local mutation         | `/compact` in visible browser completed through the Deck BFF path, displayed `压缩完成`, and reconciled compaction count to `1`; unit tests cover running and failed states. | complete                                                        |
| Gateway builtin        | `/status` reached real Gateway and rendered structured `OpenClawStatusCard`.                                                                                                 | degraded: duplicate assistant card remains                      |
| Alias remote command   | `/id` reached real Gateway and rendered identity output.                                                                                                                     | degraded: duplicate assistant output remains                    |
| Unknown command        | Code-level tests prove unknown slash commands are rejected with a toast and not sent as chat text.                                                                           | complete at code level                                          |
| Skill/plugin discovery | `deck.commands.discover` exposes skill/plugin families.                                                                                                                      | handoff-blocked for dispatch until harmless fixture is selected |

## Real Stack Evidence

- Browser URL: `http://127.0.0.1:4174/?surface=deck-ui&panel=chat&nav=expanded`
- Gateway endpoint shown in header: `ws://127.0.0.1:18789`
- Backend mode: bundled/local stack
- Test session visible in UI: `522b026d (2026-05-06)`

Sampled commands:

- `/new`
- `/t high`
- `/usage status`
- `/status`
- `/compact`
- `/id`

Auxiliary scripted evidence also exists at `deck-go/docs/evidence/chat-command-real-e2e/no-run-id-chat-command-real-convergence.json`, but per the latest user decision it is not treated as this change's hard completion gate.

## Skipped Or Handoff-Blocked Commands

- Real execution skipped for shell/process/runtime/security/media/destructive commands, including `/bash`, `/restart`, `/kill`, write modes of `/config`, `/mcp`, `/plugins`, `/allowlist`, `/approve`, `/exec`, `/elevated`, and `/tts`.
- Skill/plugin command dispatch is handoff-blocked because Gateway discovery does not yet classify command side effects well enough to choose a harmless fixture automatically.
- Shadowed Gateway builtins such as `/reset`, `/clear`, `/stop`, `/new`, `/compact`, `/think`, `/usage`, `/model`, `/fast`, `/verbose`, and `/reasoning` are intentionally represented by Deck product-local commands where Deck has typed BFF paths and durable UI state.

## Remaining Risks

- Real Gateway remote command replies can duplicate assistant output in the transcript. This was observed for `/status` and `/id`; the commands execute, but the UI row is degraded until SSE/history deduplication is tightened.
- Some safe read-only builtins such as `/commands`, `/tools`, `/tasks`, `/context`, and `/models` are discovered and mapped but were not selected for visible browser sampling in this bounded pass.
- Full package backend tests still include an unrelated `TestGatewayFacade_ChannelPatchUsesConfigGetThenConfigPatch` 502 failure; focused command mutation tests are the relevant evidence for this change.

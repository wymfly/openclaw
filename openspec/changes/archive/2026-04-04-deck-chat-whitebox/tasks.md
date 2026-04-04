## 1. Types & Store Foundation

- [x] 1.1 Extend `chat-types.ts`: add `RunMetadata` type (`model`, `usage: { input, output, cache }`, `durationMs`), `SubagentRun` type (`id`, `taskDescription`, `status`, `startedAt`, `completedAt`, `duration`, `parentRunId`, `result`, `error`), and `ParsedToolResult` union type (`bash | diff | highlighted | raw`)
- [x] 1.2 Extend `chat.ts` store: add `runMetadata: Map<string, RunMetadata>` and `subagentRuns: Map<string, SubagentRun>` per session state; add actions `setRunMetadata`, `updateSubagentRun`, `removeSubagentRun`; ensure session cleanup removes associated subagent entries
- [x] 1.3 Update `useChatSSE.ts` `dispatchAgentEvent`: extract model/usage/duration from `phase: complete` events and call `setRunMetadata`; extract subagent spawn/complete/error phases and call `updateSubagentRun`

## 2. ToolUseCard Enhancement

- [x] 2.1 Rewrite `ToolUseCard.tsx`: replace `JSON.stringify` with structured key-value renderer — top-level keys as labeled rows, nested objects as collapsible JSON sub-trees, strings >500 chars truncated with "Show full" toggle
- [x] 2.2 Add parameter summary generation for collapsed header (up to 3 key names + "...")
- [x] 2.3 Add "Copy JSON" button that copies `JSON.stringify(input, null, 2)` to clipboard with "Copied" toast
- [x] 2.4 Implement collapse behavior: default collapsed for completed messages, default expanded for streaming messages

## 3. ToolResultCard — Bash Split View

- [x] 3.1 Create `BashResultView.tsx` component: command header bar + stdout block + stderr block (red-tinted) + exit code badge (green=0, red=non-zero)
- [x] 3.2 Implement bash detection logic in `ToolResultCard`: match tool_use name (`bash`/`execute`/`terminal`) + content pattern matching for exit code
- [x] 3.3 Wire BashResultView into ToolResultCard with fallback to raw rendering on detection failure

## 4. ToolResultCard — Diff Preview

- [x] 4.1 Add `diff` npm package as dependency
- [x] 4.2 Create `DiffPreview.tsx` component: unified diff view with line numbers, added lines (green bg), removed lines (red bg), binary file detection placeholder
- [x] 4.3 Implement file operation detection in ToolResultCard: match tool_use name (`write`/`edit`/`read`) and extract file path from tool_use input
- [x] 4.4 For `read` results: render with syntax highlighting based on file extension; for `write`/`edit` results: render diff when before/after content available

## 5. ToolResultCard — Virtual Scroll

- [x] 5.1 Add `@tanstack/react-virtual` as dependency
- [x] 5.2 Create `VirtualScrollResult.tsx` component: 400px container with line count indicator ("1-50 of 1,234 lines"), "Expand" button (→ 80vh), "Collapse" button (→ 400px)
- [x] 5.3 Wire into ToolResultCard: apply virtual scroll when content exceeds 200 lines; below threshold use direct rendering without max-height truncation

## 6. Show Raw Toggle

- [x] 6.1 Add "Show Raw" / "Show Formatted" toggle button to all enhanced ToolResultCard views (bash, diff, virtual scroll)
- [x] 6.2 Toggle state is per-card (local component state), does not affect other cards

## 7. Run Status Indicator

- [x] 7.1 Create `RunStatusBar.tsx` component: compact bar with model badge, token summary (formatted: exact <1k, Nk ≥1k), duration (Ns <60s, Nm Ns ≥60s)
- [x] 7.2 Implement streaming mode: show live elapsed timer (updates every 1s) and spinning token counter
- [x] 7.3 Implement graceful degradation: show "—" for missing fields; hide bar entirely when no metadata exists
- [x] 7.4 Integrate `RunStatusBar` into `MessageBubble` — render below each assistant message, reading from `runMetadata` store

## 8. Subagent Inline Cards

- [x] 8.1 Create `SubagentCard.tsx` component: collapsible card with identifier, task description, status badge (running=blue+spinner, completed=green, failed=red), elapsed/final duration
- [x] 8.2 Implement collapse behavior: expanded by default when running, collapsed by default when completed (non-streaming message)
- [x] 8.3 Render expanded state: task description + result/error details in collapsible section
- [x] 8.4 Integrate into `MessageBubble`: render SubagentCards within assistant message content area, ordered by spawn time, reading from `subagentRuns` store

## 9. Integration & Testing

- [x] 9.1 Verify backward compatibility: unknown tool names and malformed results fall back to existing raw rendering
- [x] 9.2 Test bash split view with: successful command, failed command with stderr, unrecognizable output
- [x] 9.3 Test diff preview with: edit result containing diff, read result with syntax highlighting, binary file placeholder
- [x] 9.4 Test virtual scroll with: >200 line result, expand/collapse behavior, <200 line result (no virtual scroll)
- [x] 9.5 Test run status bar with: full metadata, partial metadata, no metadata, streaming state
- [x] 9.6 Test subagent cards with: spawn, complete, fail, multiple subagents, parent completes while subagent running
- [x] 9.7 Run `pnpm tsgo` — zero type errors
- [x] 9.8 Run `pnpm check` — lint/format pass

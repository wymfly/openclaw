## 1. Types & Store Foundation

- [ ] 1.1 Extend `chat-types.ts`: add `RunMetadata` type (`model`, `usage: { input, output, cache }`, `durationMs`), `SubagentRun` type (`id`, `taskDescription`, `status`, `startedAt`, `completedAt`, `duration`, `parentRunId`, `result`, `error`), and `ParsedToolResult` union type (`bash | diff | highlighted | raw`)
- [ ] 1.2 Extend `chat.ts` store: add `runMetadata: Map<string, RunMetadata>` and `subagentRuns: Map<string, SubagentRun>` per session state; add actions `setRunMetadata`, `updateSubagentRun`, `removeSubagentRun`; ensure session cleanup removes associated subagent entries
- [ ] 1.3 Update `useChatSSE.ts` `dispatchAgentEvent`: extract model/usage/duration from `phase: complete` events and call `setRunMetadata`; extract subagent spawn/complete/error phases and call `updateSubagentRun`

## 2. ToolUseCard Enhancement

- [ ] 2.1 Rewrite `ToolUseCard.tsx`: replace `JSON.stringify` with structured key-value renderer — top-level keys as labeled rows, nested objects as collapsible JSON sub-trees, strings >500 chars truncated with "Show full" toggle
- [ ] 2.2 Add parameter summary generation for collapsed header (up to 3 key names + "...")
- [ ] 2.3 Add "Copy JSON" button that copies `JSON.stringify(input, null, 2)` to clipboard with "Copied" toast
- [ ] 2.4 Implement collapse behavior: default collapsed for completed messages, default expanded for streaming messages

## 3. ToolResultCard — Bash Split View

- [ ] 3.1 Create `BashResultView.tsx` component: command header bar + stdout block + stderr block (red-tinted) + exit code badge (green=0, red=non-zero)
- [ ] 3.2 Implement bash detection logic in `ToolResultCard`: match tool_use name (`bash`/`execute`/`terminal`) + content pattern matching for exit code
- [ ] 3.3 Wire BashResultView into ToolResultCard with fallback to raw rendering on detection failure

## 4. ToolResultCard — Diff Preview

- [ ] 4.1 Add `diff` npm package as dependency
- [ ] 4.2 Create `DiffPreview.tsx` component: unified diff view with line numbers, added lines (green bg), removed lines (red bg), binary file detection placeholder
- [ ] 4.3 Implement file operation detection in ToolResultCard: match tool_use name (`write`/`edit`/`read`) and extract file path from tool_use input
- [ ] 4.4 For `read` results: render with syntax highlighting based on file extension; for `write`/`edit` results: render diff when before/after content available

## 5. ToolResultCard — Virtual Scroll

- [ ] 5.1 Add `@tanstack/react-virtual` as dependency
- [ ] 5.2 Create `VirtualScrollResult.tsx` component: 400px container with line count indicator ("1-50 of 1,234 lines"), "Expand" button (→ 80vh), "Collapse" button (→ 400px)
- [ ] 5.3 Wire into ToolResultCard: apply virtual scroll when content exceeds 200 lines; below threshold use direct rendering without max-height truncation

## 6. Show Raw Toggle

- [ ] 6.1 Add "Show Raw" / "Show Formatted" toggle button to all enhanced ToolResultCard views (bash, diff, virtual scroll)
- [ ] 6.2 Toggle state is per-card (local component state), does not affect other cards

## 7. Run Status Indicator

- [ ] 7.1 Create `RunStatusBar.tsx` component: compact bar with model badge, token summary (formatted: exact <1k, Nk ≥1k), duration (Ns <60s, Nm Ns ≥60s)
- [ ] 7.2 Implement streaming mode: show live elapsed timer (updates every 1s) and spinning token counter
- [ ] 7.3 Implement graceful degradation: show "—" for missing fields; hide bar entirely when no metadata exists
- [ ] 7.4 Integrate `RunStatusBar` into `MessageBubble` — render below each assistant message, reading from `runMetadata` store

## 8. Subagent Inline Cards

- [ ] 8.1 Create `SubagentCard.tsx` component: collapsible card with identifier, task description, status badge (running=blue+spinner, completed=green, failed=red), elapsed/final duration
- [ ] 8.2 Implement collapse behavior: expanded by default when running, collapsed by default when completed (non-streaming message)
- [ ] 8.3 Render expanded state: task description + result/error details in collapsible section
- [ ] 8.4 Integrate into `MessageBubble`: render SubagentCards within assistant message content area, ordered by spawn time, reading from `subagentRuns` store

## 9. Integration & Testing

- [ ] 9.1 Verify backward compatibility: unknown tool names and malformed results fall back to existing raw rendering
- [ ] 9.2 Test bash split view with: successful command, failed command with stderr, unrecognizable output
- [ ] 9.3 Test diff preview with: edit result containing diff, read result with syntax highlighting, binary file placeholder
- [ ] 9.4 Test virtual scroll with: >200 line result, expand/collapse behavior, <200 line result (no virtual scroll)
- [ ] 9.5 Test run status bar with: full metadata, partial metadata, no metadata, streaming state
- [ ] 9.6 Test subagent cards with: spawn, complete, fail, multiple subagents, parent completes while subagent running
- [ ] 9.7 Run `pnpm tsgo` — zero type errors
- [ ] 9.8 Run `pnpm check` — lint/format pass

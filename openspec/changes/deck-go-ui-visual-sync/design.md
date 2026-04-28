## Context

The old Deck Chat implementation under `dashboard/src/components/panels/chat/**` remains the visual and interaction reference for this change. It combines Tailwind/shadcn/lucide chrome with `Streamdown`-based transcript and artifact markdown rendering, collapsible tool-result cards, a richer Canvas panel, and icon-first Artifact actions.

The current `deck-go/frontend` Chat implementation is functionally broad, but it is not visually synchronized with that reference. It uses a dependency-light Vite frontend, custom `deck-ui-*` CSS, custom icon components, and a local `MarkdownText` parser. The source comparison found meaningful divergences in message bubbles, markdown semantics, tool-result card structure, Canvas overlays, Artifact renderers, Composer controls, session sidebar, context/status strips, approval dialogs, and Subagent cards.

This change is a focused follow-up to `deck-chat-visual-parity` and a child-sized slice of the broader `deck-full-visual-parity-migration` effort. It should not redefine Gateway contracts; it should make `deck-go` render the old Deck Chat experience from the Go/Gateway data it already receives, while recording backend/API gaps only when the frontend cannot reproduce old behavior from available data.

## Goals / Non-Goals

**Goals:**

- Make `deck-go` Chat visually and interactively match old Deck Chat for the analyzed desktop states.
- Restore old Deck message rendering semantics, especially markdown behavior in transcript and Artifact markdown surfaces.
- Restore old Deck tool-result, Canvas, Artifact, Composer, context/status, sidebar, approval, and Subagent visual behavior.
- Preserve the `deck-go` runtime model and generated/API facade boundaries.
- Produce paired old Deck vs `deck-go` browser evidence for representative rich Chat scenarios.

**Non-Goals:**

- Redesigning Chat beyond old Deck parity.
- Mobile parity.
- Replacing the Go backend or Gateway source of truth.
- Adding new frontend dependencies without explicit approval.
- Changing existing transcript/tool/subagent data contracts unless a blocking backend/API gap is proven during implementation.

## Decisions

### Treat old Deck Chat as the source of truth

Implementation SHALL compare each target component against the old source file and, where practical, old rendered screenshots. The component mapping is:

- Page shell and panel composition: `ChatPanel`, `RightPanel`, `SessionSidebar`, `AgentTabs`.
- Transcript and messages: `MessageList`, `TranscriptBlocks`, `transcript-render-registry`, markdown styles.
- Tool blocks: `ToolUseCard`, `ToolResultCard`, `BashResultView`, `DiffPreview`, `HighlightedCodeView`, `ShowRawToggle`, `VirtualizedOutput`.
- Canvas: `CanvasPanel`, A2UI bridge behavior, loading/error/debug states, right drawer sizing.
- Artifact: `ArtifactCard`, `ArtifactPanel`, `detectArtifact`, `SharedRenderer`, code/markdown/table/json/image/html renderers.
- Composer and runtime UI: `MessageInput`, `ChatContextBar`, `BlockFilterBar`, `ToolProgressBar`, `ApprovalDialog`, `SubagentCard`, `SubagentTree`.

Alternative rejected: continue tuning the current `deck-ui-*` implementation by visual intuition. That path risks preserving current divergences, especially where markup semantics differ from old Deck.

### Restore rendering semantics before visual polish

Message and Artifact markdown parity is the highest-risk rendering gap. The implementation should first restore old Deck visible semantics for headings, paragraphs, links, bold, emphasis, lists, nested lists, blockquotes, horizontal rules, inline code, fenced code, tables, and images before adjusting spacing and color.

Because `deck-go/frontend` currently has only React/React DOM as runtime dependencies, the default path is to extend local renderers and CSS to match old output without adding `streamdown`, lucide, Radix, shadcn, Tailwind, or Next-only dependencies. If exact parity is impossible without adopting an old Deck dependency, that dependency addition must be isolated, justified, and explicitly approved before implementation.

Alternative rejected: make `MarkdownText` only good enough for common messages. The analyzed gap affects transcript correctness, Artifact markdown, and visual evidence, so partial markdown support is not enough.

### Preserve `deck-go` architecture while matching old UI

The target should keep the Go/Vite API facade, generated types, visual-state seed hooks, and `deck-ui-*` styling approach where they do not conflict with old Deck parity. Porting old JSX wholesale is acceptable only when it does not introduce Next-only imports, core/extension boundary violations, or dependency churn.

Old iconography should be matched by local icon components or existing local primitives rather than adding lucide by default. Old shadcn/Radix behavior should be matched through accessible local markup unless a specific primitive proves necessary and approved.

Alternative rejected: import old `dashboard` components directly. That would cross app/runtime boundaries and pull Next-specific assumptions into `deck-go`.

### Validate with scenario fixtures and paired screenshots

Implementation should add deterministic rich Chat fixtures or visual seed states for the specific surfaces under test. Browser validation must capture old Deck and `deck-go` states with the same scenario content wherever both stacks can run. Unit/component tests should cover parser and renderer behavior that screenshots cannot prove precisely.

Alternative rejected: rely on green TypeScript/build/test output alone. Visual sync is perceptual and markup-sensitive; it needs browser evidence.

## Risks / Trade-offs

- Markdown parity may be large if implemented locally → mitigate by adding focused parser/render tests for the exact old Deck supported constructs before visual CSS work.
- Old Deck uses dependencies that `deck-go` intentionally avoids → mitigate by defaulting to local renderers and requiring explicit approval for any new dependency.
- Paired old/current screenshots can be noisy across viewport, fonts, and dynamic timestamps → mitigate by using deterministic fixtures, stable viewport sizes, frozen timestamps where available, and scenario-specific diff notes.
- Canvas content can be remote or dynamic → mitigate by using existing visual seed/data URL paths for deterministic Canvas states and validating live Canvas behavior separately.
- Current `deck-go` accessibility improvements may not exactly match old markup → preserve accessibility unless it changes visible behavior, and document intentional non-visual differences.

## Migration Plan

1. Build a component parity ledger from old `dashboard` files to target `deck-go` files and mark each analyzed gap as migrate, preserve-current-with-reason, or backend-gap.
2. Lock current target behavior with focused tests where behavior must not regress during visual edits.
3. Restore message and markdown rendering parity first.
4. Restore tool-result, Canvas, and Artifact renderer parity.
5. Restore Composer, context/status, sidebar, approval, and Subagent visual parity.
6. Run focused frontend tests, `deck-go` frontend build checks, and paired browser validation.
7. Record any deferred non-parity exceptions with evidence and owner.

Rollback is file-level: each surface should be migrated in small commits or task slices so a problematic renderer or panel can be reverted without undoing unrelated Chat parity work.

## Open Questions

- Whether exact Streamdown behavior is required or whether a local renderer that matches old visible output for the validation corpus is sufficient.
- Whether old lucide icons must be reproduced pixel-for-pixel or can be matched by local SVGs with equivalent size, stroke, and placement.
- Which existing visual seed scenarios should be extended versus replaced by paired old/current fixture captures.

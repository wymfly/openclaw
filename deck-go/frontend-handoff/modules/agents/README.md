# agents - high-fidelity handoff

**Status:** `revised v2 - pending implementation`
**Protocol version:** `protocol-v1`
**Active visual target:** [`./prototype.html`](./prototype.html)
**OpenSpec change:** `frontend-agents-hifi-contract-redesign`

This package replaces the earlier agents visual target for the current high-fidelity pass. The prior `deck-go-frontend-agents-rebuild` implementation remains the engineering baseline, but this package is the visual and interaction target for the next production rewrite.

## What this module does

`agents/` is an operational cockpit for OpenClaw agent identity and configuration. It lets an operator scan agent health, select an agent, edit backend-supported identity fields, manage current skill/subagent/event-stream semantics, inspect tool-policy and system-prompt previews, browse workspace files, create agents, and confirm destructive deletes.

The design is intentionally dense and work-focused. It uses the same Inter/JetBrains Mono typography and `--ds-*` token posture validated by chat, but it keeps module-specific row, section, and preview molecules local until routing/subagents prove repetition.

## Contract truth

Production and mocks must use the current Deck-facing DTOs:

- `DeckGoAgentsListResponse`
- `DeckGoAgentSummary`
- `DeckGoAgentDetailResponse`
- `DeckGoAgentSkillsResponse`
- `DeckGoAgentSubagentConfigResponse`
- `DeckGoAgentEventStreamsResponse`
- `DeckGoAgentToolPolicyPreviewResponse`
- `DeckGoAgentSystemPromptPreviewResponse`
- `DeckGoAgentFilesResponse`
- `DeckGoAgentFileResponse`
- `DeckGoAgentMutationResponse`

Unsupported ideal features stay documented, not implied in UI: server-side list query, cursor pagination, composite hashes, `activity.event.eventType`, per-kind `/deck/agents/*` routes, and `"inherit" | "explicit" | "none"` skill semantics.

## Depends on canonical atoms

`Badge`, `Banner`, `Button`, `Card`, `Chip`, `Input`, `Modal`, `SegmentedControl`, `Spinner`, `Textarea`, and `Toggle`.

No canonical atom or token is required by this handoff. Local molecules:

- agent avatar/initial block
- metric tile
- agent row summary
- detail hero
- config section header
- policy/preview/file rows
- empty/error state panel

## How to implement

1. Open `prototype.html` and inspect ready, empty, error, and create states via the toolbar controls.
2. Read `api-usage.md` before touching mocks or API wrappers.
3. Translate the prototype into `frontend-new/src/components/panels/agents/` using existing atoms/tokens and the current agents store.
4. Keep raw endpoint/action strings inside `frontend-new/src/api.ts` or tests only.
5. Add mock visual E2E with contract-shaped data and label the evidence as mock visual coverage.
6. Update `implementation-notes.md` with any production divergence and design-system feedback.

## Open questions for follow-up

- Whether list aggregation should eventually include server-side session counts and last active time.
- Whether Gateway should add query support to `agents.list`.
- Whether skill modes should migrate from `"all" | "whitelist"` to product-facing labels later.
- Whether repeated row/section molecules from agents + routing/subagents should become shared design-system patterns.

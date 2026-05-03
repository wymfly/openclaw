## Context

`deck-go-frontend-agents-rebuild` already made agents available in `frontend-new`, added the shared agents store, and pushed the minimum useful agents DTOs into the Deck-facing contract chain. That work is intentionally reused as the engineering base for this change.

The current problem is quality and convergence, not raw availability. The existing agents UI and earlier handoff package were produced before the chat high-fidelity parity pass established the stricter workflow: contract-led high-fidelity handoff, production translation, mock visual E2E, and a design-system feedback record. The user also clarified that current frontend panels may be rough and partially correct, while the frontend shell and contract-facing skeleton are basically valid.

Key constraints:

- Browser code must continue to talk through `frontend-new/src/api.ts` and the deck-go backend, never directly to Gateway.
- Contract truth comes from `deck-go/contracts/source/*`, generated DTOs, backend handlers, and `frontend-new/src/api-types.ts`.
- Visual truth for this change comes from the new `frontend-handoff/modules/agents/prototype.html`, not the older agents prototype.
- Existing `frontend-new` shell, panel registry, shared stores, generated artifacts, and design-system atoms/tokens are the engineering skeleton to preserve.
- Mock data used by tests and prototypes must be contract-shaped and must not imply unsupported Gateway capabilities.

## Goals / Non-Goals

**Goals:**

- Produce a fresh Codex-owned agents high-fidelity handoff package that satisfies the current contract and design-system rules.
- Rework the production agents panel so the list, detail workbench, section navigation, create flow, destructive actions, and empty/error/loading states visually converge with the handoff.
- Keep deterministic contract/API/mock drift fixed when the supported truth is clear.
- Leave uncertain Gateway/product-contract gaps as explicit discrepancy or follow-up notes.
- Add mock-backed Playwright coverage for agents visual review and targeted unit/a11y coverage for changed logic.
- Record design-system feedback and update the cross-module readiness record for agents.

**Non-Goals:**

- Do not redesign chat.
- Do not implement routing, subagents, sessions, or other panels in this change.
- Do not introduce new frontend dependencies, canonical atoms, or global tokens unless a narrow accessibility or cross-module need is proven during implementation.
- Do not add real Gateway/LLM E2E as an acceptance gate for this visual convergence pass.
- Do not change Gateway source schemas for ideal agents v2 features such as server-side list query, composite hashes, or `activity.event.eventType` unless those are already supported upstream.

## Decisions

### D1: Follow-up change instead of reopening `deck-go-frontend-agents-rebuild`

This change treats the existing agents rebuild as the contract and engineering baseline, then adds the missing high-fidelity visual workflow on top. Reopening or duplicating the previous change would mix a completed contract migration with a new design-quality pass and make archive evidence harder to trust.

Alternative considered: archive the old agents change and skip a new agents pass. Rejected because the new objective explicitly requires every module to go through handoff, mock visual E2E, design-system feedback, and archive-ready OpenSpec evidence.

### D2: New handoff replaces the old agents visual target

The old `frontend-handoff/modules/agents/` package is useful evidence about intended surfaces and contract discrepancies, but the new `prototype.html` and companion docs produced by this change become the visual and interaction truth. The package must preserve useful discrepancy notes while updating status and implementation guidance.

Alternative considered: use the existing prototype directly. Rejected because the user already found earlier agents design direction unsatisfactory, and chat parity showed that stale handoff assumptions can hide typography, canvas, and surface-treatment drift.

### D3: Contract-shaped mocks, not fantasy mocks

Visual seeds and Playwright mocks will use `DeckGoAgentSummary`, `DeckGoAgentDetailResponse`, skills, subagents, files, streams, and preview DTOs as currently declared. Missing optional fields render as unavailable or neutral UI, not invented zeros or unsupported claims.

Alternative considered: generate rich idealized mock data matching the older handoff v2 contract. Rejected because it would make the UI converge to an unsupported API and obscure the remaining Gateway gaps.

### D4: Enterprise workbench density with local molecules

Agents should feel like an operational configuration cockpit: dense but scannable, quiet typography, stable row heights, compact status vocabulary, side-by-side list/detail structure, and immediate edit feedback. Module-specific structures such as agent row summaries, section headers, file rows, and policy provenance rows remain local molecules unless repeated in later modules.

Alternative considered: promote local molecules into design-system patterns immediately. Rejected because the feedback-loop guidance says early modules should prove repetition across multiple panels before adding shared API surface.

### D5: Preserve API facade and shell boundaries

Production code will continue to call `src/api.ts` wrappers and use the active panel shell/registry. Raw endpoint/action strings belong only inside the API facade or test mock routing. If a wrapper is wrong or missing and the correct contract is clear, the wrapper can be fixed inside this change.

Alternative considered: let panel code call endpoints directly for speed. Rejected because this breaks the contract-chain development model the user wants to rely on for future frontend work.

## Risks / Trade-offs

- **Visual scope expands into contract redesign** → Keep contract changes limited to deterministic drift. Document uncertain deltas as follow-ups.
- **Mock visual E2E gives false confidence about real Gateway behavior** → Name the tests as mock visual coverage and keep real Gateway E2E out of the acceptance claim.
- **Agents local molecules become inconsistent with later modules** → Record candidates in implementation notes and revisit after routing/subagents provide repetition evidence.
- **Existing agents panel is large and intertwined** → Refactor in vertical slices and keep tests around list/detail/create/save/delete behavior.
- **OpenSpec repository has unrelated old failing specs** → Validate this change strictly and validate touched specs after archive; report repo-wide failures separately if encountered.

## Migration Plan

1. Create the fresh agents handoff package and record the old-vs-new visual target decision.
2. Add or update contract-shaped mock fixtures for agents list/detail/sections.
3. Translate the prototype into `frontend-new` agents production components and CSS using existing atoms/tokens.
4. Add unit/a11y tests for changed list/detail/create/save/delete flows.
5. Add mock Playwright visual coverage for agents primary states.
6. Update cross-module readiness and implementation notes with design-system feedback.
7. Run OpenSpec validation, focused frontend verification, visual E2E, and frontend build.
8. Archive this change and commit it separately.

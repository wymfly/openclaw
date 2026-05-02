# frontend-new Codex Guide

This file is the Codex-native execution guide for `deck-go/frontend-new/`.
It adapts the existing Claude Design plus Claude Code handoff protocol into a
single-agent workflow: Codex owns both the design artifact and the production
implementation.

## Scope

- This guide applies to `frontend-new/` and all child paths.
- `frontend-new/CLAUDE.md` and `../frontend-handoff/CLAUDE.md` remain useful
  protocol background, but this file is the operating guide for Codex.
- New frontend modules land in `src/components/panels/<module>/`.
- Do not add new work to legacy `../frontend/` unless the user explicitly asks
  for legacy maintenance.

## Module Authority

`frontend-new` has two implementation lanes:

- **New authority** modules: `chat`, `agents`.
  These are governed by their `frontend-new` OpenSpec changes and current source
  in this workspace. Do not overwrite them from `../frontend/`.
- **Preserved** modules: `gateway`, `models`, `usage`, `sessions`, `memory`,
  `logs`, `activity`, `threads`, `api-explorer`, `cron`, `webhooks`,
  `approvals`, `skills`, `budget`, `alerts`, `channels`, `plugins`, `routing`,
  `subagents`, `identity`, `config`, `nodes`, `docs`, and `settings`.
  These preserve the frozen `../frontend/` product surface inside the active
  workspace. Future redesigns start from this preserved behavior and change it
  explicitly.

Preserved modules depend on the restored host and import chain:
`src/deck-ui/`, `src/components/shared/`, `src/components/runtime/`,
`src/hooks/`, `src/stores/`, `src/lib/`, `src/api.ts`, `src/api-types.ts`,
`src/i18n/`, and `src/theme.css`.

Protected surfaces during preservation or future bulk migration:

- `src/components/panels/chat/`
- `src/components/panels/agents/`
- `src/design-system/`
- `src/generated/`
- generated contract artifacts under `../contracts/generated/`
- generated DTO facades unless regenerated from contract source

## Source Of Truth

Use code truth first.

- Real implementation truth lives in this directory's source tree.
- Contract truth lives in `../contracts/source/`, `../contracts/generated/`,
  and the frontend facades in `src/api-types.ts` and `src/api.ts`.
- Design-system truth lives in `src/design-system/tokens/index.css`,
  `src/design-system/atoms/`, `src/design-system/hooks/`, and the dev gallery.
- Handoff package status lives in `../frontend-handoff/modules/<module>/README.md`
  when a module package exists.
- Do not treat `../docs/project/current-state.md` as authoritative onboarding
  state. If it exists, it is only a stale-prone snapshot. Prefer `rg`, `find`,
  and direct source inspection.

If any document disagrees with source code, generated artifacts, contract gate
output, or tests, trust the implementation and update docs only after verifying
the real state.

## Solo Design-To-Code Workflow

For a substantial new panel or redesign, run this sequence in one Codex session:

1. Read the contracts for the target module.
   Start with `src/api-types.ts`, `src/api.ts`,
   `../contracts/generated/ts/deck-ui-metadata.generated.ts`,
   `../contracts/source/deck-ui.contract.json`, and any relevant stream or
   exception contract.
2. Read the design system.
   Inspect `src/design-system/tokens/index.css`,
   `src/design-system/atoms/index.ts`, relevant atom implementations, hooks, and
   `src/design-system/dev/Gallery.tsx`.
3. Read existing module examples.
   `src/components/panels/chat/` is the current complex implementation example.
   `../frontend-handoff/modules/chat/` is a reverse-derived handoff example, not
   a forward-design template to copy blindly.
4. Produce a module handoff package when the work is more than a trivial tweak.
   Create or update `../frontend-handoff/modules/<module>/` with:
   `README.md`, `prototype.html`, `components.md`, `states.md`,
   `interactions.md`, and `api-usage.md`. Add `tokens-proposal.md` only when a
   token change is actually required.
5. Implement the real module in `src/components/panels/<module>/`.
   Translate the prototype into React/TypeScript/CSS using existing atoms,
   hooks, tokens, stores, API wrappers, and project patterns.
6. Record implementation reality.
   If production constraints force divergence from the handoff, add
   `implementation-notes.md` in that module's handoff directory.
7. Verify and sign off.
   Run the narrowest relevant tests first, then `npm run build` or the deck-go
   frontend verification target requested by the parent guide. For visual work,
   use the dev gallery and the module's visual seed or prototype comparison when
   available.

For a small visual-only adjustment, use the lite lane:

- Keep the change local and focused.
- Avoid a full six-file handoff package.
- Still verify token use, responsive behavior, focus states, and build output.

## Contract Rules

- UI components should call functions from `src/api.ts`; do not scatter raw
  endpoint strings inside panels.
- Panel code should import Deck-facing types through `src/api-types.ts` unless
  there is a concrete reason to inspect generated artifacts.
- If a needed DTO is missing or wrong, update the contract source first, then
  regenerate. Do not patch generated files by hand.
- If `api-usage.md` or a prototype assumes a backend shape that the contract or
  route handler does not support, do not fake it in UI code. Create
  `../frontend-handoff/modules/<module>/api-discrepancy.md` with:
  design assumption, backend/contract truth, user impact, and the proposed
  resolution path.
- Treat `../contracts/source/deck-exceptions.contract.json` and
  `../docs/gateway-untyped-exceptions.md` as warning labels. Do not build strong
  UI assumptions on documented dynamic surfaces without checking the exit
  criteria.

## Design-System Rules

- Production code must use `--ds-*` tokens for color, spacing, radius, shadow,
  density, and typography decisions.
- Prefer existing atoms and hooks from `src/design-system/`.
- Do not create module-local replacements for Button, Input, Badge, Modal,
  Drawer, Tooltip, Popover, TableView, or similar canonical atoms.
- Compose module-local molecules freely inside the module directory when they
  are business-specific or only used once.
- Promote a molecule or pattern to `src/design-system/patterns/` only when it is
  cross-module, stable, and worth the shared API cost.
- Do not hand-edit generated files or design-system mirrors to silence drift.
  Fix the source and rerun the matching sync/check target.

## Prototype Guidance

When Codex replaces the design agent, use the local design method documents as
tools, not authorities:

- `../docs/skills/ui-requirements-elicitation.md` for unclear UI intent.
- `../docs/skills/wireframe.md` when multiple layout directions are needed.
- `../docs/skills/interactive-prototype.md` for high-fidelity clickable module
  prototypes.
- `../docs/skills/make-tweakable.md` when a prototype needs controlled variants.
- `../docs/skills/design-system-feedback-loop.md` for deciding whether a new
  module-local component should feed back into the design system.
- `../docs/design-references/` for taste anchors. Use them to choose density and
  interaction posture, not to override deck-go tokens.

Prototypes are design references, not production code. Keep class names,
interaction timings, responsive behavior, empty/loading/error states, and token
intent when translating them into real React code.

## Verification

Choose verification by touched surface:

- TypeScript/build: `npm run build` from `frontend-new/`.
- Frontend tests: `npm run test:deck-ui` from `frontend-new/`.
- Design-system changes: exercise `?dsGallery=1` in dev when browser access is
  available, and run atom/hook tests.
- Contract changes: run the matching deck-go contract sync/check target from
  `..`, then the relevant frontend build.

Do not claim completion until code builds or you explicitly report why a check
could not be run.

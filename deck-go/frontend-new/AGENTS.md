# frontend-new Agent Guide

This file is the canonical execution guide for `deck-go/frontend-new/`.
`CLAUDE.md` is a symlink to this file so Codex and Claude Code share the same
rules. It adapts the existing Claude Design plus Claude Code handoff protocol
into a single-agent-capable workflow: the active agent may own both the design
artifact and the production implementation.

## Scope

- This guide applies to `frontend-new/` and all child paths.
- `frontend-new/CLAUDE.md` points here. `../frontend-handoff/AGENTS.md` remains
  useful protocol background for design-to-engineering handoff work.
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

## Module Completion Evidence

Module completion must be backed by fresh, tracked evidence. Historical
OpenSpec checkboxes, old session memory, `.local` screenshots, or previous chat
conclusions are context only; they do not prove current completion.

Use three evidence levels when a module is materially implemented or redesigned:

- **mock functional**: the mock-backed page opens, key interactions work,
  unexpected console/page/API errors are checked, and screenshots are produced.
- **mock prototype parity**: the active
  `../frontend-handoff/modules/<module>/prototype.html` and the current
  `frontend-new` page are compared in the same viewport, locale, theme, and nav
  state with a structured verdict.
- **real Gateway evidence**: the real Gateway/BFF path is exercised. Minimum
  coverage is shell navigation into the module, light/dark mode, Chinese/English
  mode, key tabs/drawers/dialogs interactable, browser does not call Gateway
  directly, unexpected console/page/BFF errors are empty, and safe run-scoped
  real test data is created when the module supports writes.

Real data should be created through Gateway RPC or Deck BFF routes first. Direct
seeding of isolated `openclaw.json`, workspace files, sessions, or similar
OpenClaw data sources is acceptable only in the isolated real-stack test
environment. Test object names must include the run id, and cleanup must refuse
to touch objects that do not include that run id. High-impact resources such as
external accounts, installed skills, device tokens, and user memory may be
marked `skipped-safe`, but read-path UI and link verification still need to run.

Persist module closure in a tracked manifest, README, or implementation note.
`.local` artifacts are temporary; tracked evidence must link the command,
artifact path, verdict/status, run id when applicable, and accepted exceptions.
`unreviewed` must remain `unreviewed`; do not turn it into visual sign-off by
wording.

Implemented module handoff README files use:

```markdown
**Status**: implemented (sha <40-hex-commit-sha>)
```

They also need a structured `Reverse sign-off` section with final status
(`accepted`, `accepted-with-exceptions`, `needs-revision`, or `blocked`),
reviewer, date, prototype reference, production reference, mock functional
evidence, mock prototype parity evidence, real Gateway evidence, and accepted
exceptions.

Single-file panels are a maintainability concern, not automatically a protocol
violation. Treat them as blocking only when the active OpenSpec change, module
handoff, or maintainability proposal explicitly requires decomposition.

If implementation follows an external review or cross-agent report, create a
tracked fact baseline first. Classify findings as `accepted`, `corrected`,
`rejected`, or `deferred-uncertain`, and attach rerunnable commands or file
references for accepted/corrected items.

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

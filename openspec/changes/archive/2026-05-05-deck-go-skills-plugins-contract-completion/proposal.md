## Why

Skills and Plugins already have mock and real read-path evidence, but the head
matrix still leaves their completion deferred because several Skills product
surfaces are too dynamic and write actions lack action-level safety evidence.
Plugins also need the dynamic-envelope question closed against current code
truth rather than left as an open follow-up.

## What Changes

- Re-audit Skills and Plugins against Gateway methods, Deck BFF routes,
  Deck-facing DTOs, dynamic-surface metadata, mutation evidence, frontend
  facades, panels, and mock/real evidence.
- Normalize the Deck-facing Skills inventory response to `DeckGoSkillEntry[]`
  instead of `Record<string, unknown>[]` while keeping the frontend tolerant of
  older/raw Gateway-shaped rows.
- Add a typed Deck-facing Skills install response DTO and narrow the Skill Hub
  mutation response envelope to current Gateway result shapes.
- Add action-level mutation evidence for Skills update/install and Skill Hub
  install/update actions, with skipped-safe or deferred fixture status until
  disposable workspace/config fixtures exist.
- Route Skills mutation frontend facades through the shared mutation evidence
  helper without changing panel behavior.
- Confirm Plugins inventory has no accidental dynamic contract leaves; keep
  manifest/audit/lifecycle/marketplace/trust surfaces unsupported or degraded
  until real Gateway/Deck contracts exist.
- Update Skills/Plugins implementation notes, the contract-chain matrix,
  generated matrix Markdown, dynamic-surface docs, mutation-evidence docs, and
  head verification evidence.

## Capabilities

### New Capabilities

- `deck-go-skills-plugins-contract-completion`: Completes Skills and Plugins
  contract-chain closure by narrowing Skills product DTOs, recording Skills
  mutation evidence, confirming Plugin dynamic surfaces are intentional, and
  documenting remaining workspace-write and plugin lifecycle limits.

### Modified Capabilities

- None.

## Impact

- Affected contracts/generated artifacts:
  `deck-go/contracts/source/deck-api.contract.ts`,
  `deck-go/contracts/source/deck-mutations.contract.json`, generated Deck API
  TS/Go artifacts, mutation evidence metadata/docs, dynamic-surface docs, and
  contract-chain matrix docs.
- Affected backend:
  Skills inventory BFF response normalization in
  `deck-go/backend/internal/server/inventory.go`.
- Affected frontend/tests:
  Skills API facade typing and mutation evidence wrapping, skill model
  tolerance for normalized or raw rows, focused API/mutation/panel tests.
- No plugin lifecycle mutation route, plugin manifest/audit route, marketplace
  trust contract, package signature verification, or real workspace-writing
  fixture is introduced.

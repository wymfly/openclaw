## 1. Skills / Plugins Contract Audit

- [x] 1.1 Re-read Skills and Plugins matrix rows, implementation notes, Deck-facing contracts, generated artifacts, dynamic-surface metadata, mutation evidence metadata, BFF/runtime routes, frontend facades, and mock/real E2E specs.
- [x] 1.2 Confirm supported, degraded, skipped-safe, unsupported, or deferred workflows with source evidence.

## 2. Skills Contract And Runtime Alignment

- [x] 2.1 Narrow the Deck-facing Skills inventory and Skill Hub mutation DTOs, add a Skills install DTO, and regenerate Deck API artifacts.
- [x] 2.2 Normalize `/api/skills` BFF responses to `DeckGoSkillEntry[]` while keeping frontend normalization tolerant of raw rows.
- [x] 2.3 Add Skills update/install and Skill Hub install/update mutation evidence and regenerate mutation evidence artifacts.
- [x] 2.4 Route Skills mutation frontend facades through mutation evidence helpers and update focused frontend tests.

## 3. Plugins Closure And Evidence

- [x] 3.1 Confirm Plugins inventory has no accidental dynamic DTO leaves and document unsupported plugin lifecycle/trust surfaces.
- [x] 3.2 Update Skills and Plugins implementation notes, contract-chain audit matrix rows, generated matrix Markdown, dynamic-surface docs, mutation-evidence docs, and head verification evidence.
- [x] 3.3 Run focused contract, backend, frontend, build, OpenSpec, and diff checks.
- [x] 3.4 Archive the OpenSpec change and validate the archived spec.

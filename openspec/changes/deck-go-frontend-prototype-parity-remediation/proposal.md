## Why

The recent `frontend-new` module passes produced useful contract wiring and mock
screenshots, but the evidence did not prove high-fidelity alignment with the
active `frontend-handoff/modules/*/prototype.html` artifacts. A 2026-05-05 audit
confirmed that mock visual specs mostly capture screenshots and assert basic
rendering, while many modules still differ structurally from their prototypes.

This change establishes a remediation head for deck-go frontend prototype
parity. It preserves prior archived proposals as historical evidence, downgrades
their screenshot-only visual evidence where appropriate, and defines the stricter
workflow that all module correction child proposals must follow.

## What Changes

- Create a deck-go frontend prototype parity remediation head change that owns:
  - the module remediation matrix;
  - the active prototype truth rule;
  - the mock visual parity gate;
  - the real Gateway E2E circuit-breaker rule;
  - the archive-readiness criteria for module child proposals.
- Add a reusable parity evidence workflow that captures:
  - active prototype screenshot;
  - mock current `frontend-new` screenshot;
  - side-by-side contact sheet;
  - structured visual verdict;
  - accepted-exception ledger with source/prototype/current references.
- Fix or track the currently failing mock visual specs before using them as a
  quality signal:
  - `api-explorer`;
  - `approvals`;
  - `logs`.
- Require every module child proposal to separate:
  - mock functional evidence;
  - mock prototype visual parity evidence;
  - real Gateway functional/visual evidence with circuit breaker.
- Require deterministic code or fixture defects found during parity work to be
  fixed in the owning child proposal, while environment-dependent real E2E
  failures may be circuit-broken and handed off with evidence.
- Use `agents` as the first remediation sample after the parity gate is in place,
  then continue module-by-module until all active `frontend-new` panels have
  updated parity evidence or accepted exceptions.
- Do not rewrite prior archived proposals. New evidence supersedes weak old
  visual claims through this head change and its child proposals.

## Capabilities

### New Capabilities

- `frontend-prototype-parity-remediation`: Defines the strict deck-go
  prototype-parity remediation workflow, evidence contract, module matrix, and
  child-proposal archive criteria.

### Modified Capabilities

- `frontend-handoff-protocol`: Strengthen the design-to-engineering protocol so
  a module implementation cannot claim visual alignment from screenshot capture
  alone; active prototype comparison and explicit verdict evidence become
  required.

## Impact

- OpenSpec:
  - new remediation head artifacts under
    `openspec/changes/deck-go-frontend-prototype-parity-remediation/`;
  - later child proposals for visual parity infrastructure and individual
    module remediation.
- Documentation:
  - `deck-go/docs/project/frontend-prototype-gap-audit.md`;
  - `deck-go/docs/CLAUDE.md`;
  - module `frontend-handoff/modules/<module>/implementation-notes.md` or
    equivalent evidence notes.
- Frontend tests and tooling:
  - `deck-go/test/e2e/*-visual.spec.ts`;
  - parity screenshot/contact-sheet generation scripts or test helpers;
  - mock Gateway fixtures where deterministic drift exists.
- Frontend implementation:
  - `deck-go/frontend-new/src/components/panels/<module>/` for each child
    proposal that remediates a module.
- Backend/contract chain:
  - only touched when a module remediation finds deterministic contract or BFF
    defects supported by Gateway truth.

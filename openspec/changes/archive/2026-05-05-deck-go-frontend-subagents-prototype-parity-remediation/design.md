## Context

Subagents is Deck's operational view for delegated agent runs and per-agent
subagent permission policy. The current contract chain is:

`SubagentsPanel` -> `frontend-new/src/api.ts` wrappers -> Deck BFF routes:

- `GET /api/deck/subagents`;
- `POST /api/deck/subagents` action=`lineage`;
- `POST /api/deck/subagents` action=`kill`;
- `POST /api/deck/subagents` action=`steer`;
- `POST /api/deck/agents` action=`subagents.get`;
- `POST /api/deck/agents` action=`subagents.set`;
- read-only `GET /api/config` for global defaults context.

Those routes adapt typed `deck.subagents.*` and
`deck.agents.subagents.*` Gateway methods through the deck-go backend.
Deck-facing DTO authority lives in `contracts/source/deck-api.contract.ts`.

The active visual target is
`frontend-handoff/modules/subagents/prototype.html`. Production already exposes
a runs/permissions/detail workbench, but the head matrix has not verified strict
prototype parity or strengthened real Gateway product-flow evidence.

## Goals / Non-Goals

**Goals:**

- Confirm the active Subagents prototype and reconcile it with current Gateway,
  BFF, Deck-facing DTO, mutation, config-hash, and frontend wrapper truth.
- Audit production Subagents code, handoff files, mock fixtures, and real E2E
  against the strengthened head remediation standard.
- Fix deterministic visual, interaction, i18n, fixture, route-wrapper,
  mutation-evidence, or documentation drift when supported by code truth.
- Preserve BFF-only browser access for runs, lineage, kill, steer, per-agent
  config get/set, and global defaults reads.
- Exercise representative real product data through route shapes and, when
  safely available, disposable active run or config fixture evidence.
- Validate that kill, steer, and subagent permission writes remain
  confirmation-gated and skipped-safe unless the test owns a disposable
  run-scoped target and cleanup proof.
- Upgrade mock visual and real Gateway E2E to cover shell navigation, all four
  localized theme variants, safe child interactions, route-shape evidence,
  BFF-only transport, unexpected-error evidence, and accepted exceptions.
- Update Subagents implementation notes, the remediation matrix, and head task
  `6.10`.

**Non-Goals:**

- Do not add a dedicated audit route.
- Do not add `stalled` or `killed` as new Gateway filter schema values.
- Do not add client-generated steer dedup keys.
- Do not claim kill cascade semantics without Gateway evidence.
- Do not perform live kill/steer/config writes without a disposable target and
  cleanup or revert proof.
- Do not replace the production module wholesale with prototype files.

## Decisions

### D1: Subagents uses Gateway status truth

The prototype is the visual and interaction reference, but Gateway/BFF contract
truth wins. The list filter schema remains `active | completed | failed |
timeout | all`; prototype-only `running | succeeded | killed | stalled` states
must be mapped to supported product states or recorded as accepted exceptions.

### D2: Permissions writes are config-hash aware

Per-agent permission saves must use the prior `configHash` as `baseHash`.
Hash-missing or hash-conflict states must render degraded/error feedback instead
of silently writing.

### D3: Live operations require a disposable target

Real kill and steer evidence can become mutation evidence only when the test
owns a disposable active subagent run. Otherwise those actions remain
dialog-gated and skipped-safe, with route-shape evidence for invalid or
unavailable targets.

### D4: Audit remains an honest degraded projection

The prototype includes an audit tab, but no current BFF/Gateway audit route is
declared for Subagents. Production may show the tab as unsupported/degraded,
but must not invent a route or fabricate durable audit history.

### D5: Browser transport remains BFF-only

Subagents browser code may call relative `/api/*` routes through the frontend
API facade, but it must not call the Gateway port directly.

## Risks / Trade-offs

- **Risk: real stack has no subagent runs.** -> Verify route shapes and
  empty/degraded UI states, and try fixture creation only when a disposable run
  path exists.
- **Risk: kill/steer affects user work.** -> Require run-id ownership before
  mutation, otherwise record skipped-safe and exercise dialogs only.
- **Risk: permission config writes affect real agents.** -> Prefer read shapes
  and hash-missing/conflict checks; write only against a disposable agent config
  if the test can revert.
- **Risk: prototype status taxonomy is richer than Gateway filters.** -> Use
  Gateway status truth in code and record prototype-only labels as accepted
  exceptions.

## Migration Plan

1. Audit prototype files, production Subagents code, contract sources, BFF
   routes, mock Gateway support, visual spec, real E2E, and mutation-evidence
   policy.
2. Patch deterministic Subagents UI, i18n, API facade, fixture, mutation guard,
   or documentation drift.
3. Upgrade mock visual E2E to capture dense runs, selected detail, lineage,
   permissions, dialogs, raw/outcome, and all required localized theme variants.
4. Upgrade real Gateway E2E to verify route shapes, shell navigation, all
   localized theme variants, safe child interactions, BFF-only transport,
   unexpected-error evidence, and safe mutation fixture or skipped-safe policy.
5. Update implementation notes and the head matrix, validate, then archive this
   child proposal.

## Open Questions

- Whether Gateway should expose a dedicated Subagents audit projection.
- Whether killed/stalled should become first-class status taxonomy.
- Whether kill should cascade through descendants.
- Whether steer should accept client-generated dedup keys.
- Whether real E2E should seed a disposable active subagent run through a
  controlled Gateway test hook.

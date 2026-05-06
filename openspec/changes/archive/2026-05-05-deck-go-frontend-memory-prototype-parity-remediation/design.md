## Context

Memory is Deck's memory-store control plane. The current contract chain is:

`MemoryPanel` -> `frontend-new/src/api.ts` wrappers -> Deck BFF routes:

- `GET /api/memory/browse?agentId={agentId}&path={path}`;
- `GET /api/memory/browse?agentId={agentId}&path={path}&read=1`;
- `POST /api/memory/search`;
- compatibility `GET /api/memory/search`;
- `GET /api/memory/health`;
- `POST /api/memory/dreams`.

Those routes adapt workspace file reads, `agents.files.list`, LanceDB/search
adapter state, `doctor.memory.status`, and `doctor.memory.*` Gateway methods
through the deck-go backend. Deck-facing DTO authority lives in
`contracts/source/deck-api.contract.ts`.

The active visual target is
`frontend-handoff/modules/memory/prototype.html`. Production already exposes a
four-tab workspace with Browse, Search, Health, and Dreams. This child proposal
must close strict parity evidence and strengthen real Gateway validation.

## Goals / Non-Goals

**Goals:**

- Confirm the active Memory prototype and reconcile it with current Gateway,
  BFF, and Deck-facing memory contract truth.
- Audit production Memory code, handoff files, mock fixtures, and real E2E
  against the strengthened head remediation standard.
- Fix deterministic visual, interaction, i18n, fixture, route-wrapper,
  mutation-evidence, or documentation drift when supported by code truth.
- Preserve BFF-only browser access for memory browse/read/search/health/dreams
  data.
- Exercise representative real product data through route shapes and, when
  safely available, real browse/read/search and dream-diary read flows.
- Validate that destructive dream actions remain confirmation-gated and
  skipped-safe unless disposable fixture roots and cleanup proof exist.
- Upgrade mock visual and real Gateway E2E to cover shell navigation, all four
  localized theme variants, safe child-tab interactions, route-shape evidence,
  BFF-only transport, unexpected-error evidence, and accepted exceptions.
- Update Memory implementation notes, the remediation matrix, and head task
  `6.7`.

**Non-Goals:**

- Do not replace the existing Memory implementation wholesale with prototype
  files.
- Do not add a markdown dependency.
- Do not implement LanceDB semantic search in this pass.
- Do not execute destructive dream reset/backfill/repair/dedupe actions against
  user memory unless the test proves disposable fixture roots and cleanup.
- Do not add direct memory editing.

## Decisions

### D1: Memory is a control plane, not a direct file editor

The prototype is the visual and interaction reference, but the Deck/Gateway/BFF
contract truth wins. Browse/read are read-only product surfaces. Direct edit is
out of scope.

### D2: Search degraded state is valid product truth

The canonical search wrapper uses `POST /api/memory/search`. Until a LanceDB
adapter exists, `501` / `lanceDbEnabled=false` is a first-class degraded state,
not a UI failure.

### D3: Destructive dream actions stay skipped-safe

Dream diary read is safe. Destructive actions require operator intent and
disposable fixture roots before automated real execution can claim success.

### D4: Browser transport remains BFF-only

Memory browser code may call relative `/api/*` routes through the frontend API
facade, but it must not call the Gateway port, LanceDB, or workspace filesystem
directly.

## Risks / Trade-offs

- **Risk: real memory store is empty or workspace path is unavailable.** ->
  Verify route shapes and empty/degraded UI states, and record circuit-break
  evidence instead of inventing memory files.
- **Risk: search returns 501 by design.** -> Treat as degraded success when the
  response shape has `lanceDbEnabled=false` or an unavailable reason.
- **Risk: dream actions mutate user memory.** -> Run only read by default; keep
  mutating actions confirmation-gated and skipped-safe.
- **Risk: per-agent dreams are not truly supported upstream.** -> Keep the
  current caveat visible in notes and evidence.

## Migration Plan

1. Audit prototype files, production Memory code, contract sources, BFF routes,
   mock Gateway support, visual spec, real E2E, and mutation-evidence policy.
2. Patch deterministic Memory UI, i18n, API facade, fixture, mutation guard, or
   documentation drift.
3. Upgrade mock visual E2E to capture Browse, Search, Health, Dreams, file read,
   degraded search, confirmation states, and all required localized theme
   variants.
4. Upgrade real Gateway E2E to verify route shapes, shell navigation, all
   localized theme variants, safe child interactions, BFF-only transport, and
   unexpected-error evidence.
5. Update implementation notes and the head matrix, validate, then archive this
   child proposal.

## Open Questions

- Whether LanceDB semantic search should be implemented in deck-go BFF or
  upstream Gateway.
- Whether dream maintenance actions should expose progress via SSE or polling.
- Whether mutating dream actions should write audit feed entries.
- Whether direct memory editing belongs in this control surface.

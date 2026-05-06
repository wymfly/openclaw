## Context

Docs is a Deck-local runtime document registry extracted from session history
and rendered through existing frontend Markdown primitives. Memory is mostly
Gateway-backed through agent workspace and `doctor.memory.*` methods, with
Deck-local browse/search fallback semantics. Both modules have mock and real
read-path evidence, but their matrix rows remain degraded because writes and
degraded actions are not fully expressed in shared contract metadata.

Current source truth:

- Docs list/detail/extract/delete are Deck BFF routes over localstore plus
  Gateway chat history for extraction.
- Docs list already participates in the shared list-query contract.
- Memory browse/read resolves a workspace through Gateway agent files and reads
  under safe path guards.
- Memory search intentionally returns 501 until a LanceDB adapter exists.
- Memory dream actions call `doctor.memory.*`; read is safe, mutating actions
  can affect operator memory and remain skipped/deferred without disposable
  fixtures.

## Goals / Non-Goals

**Goals:**

- Make Docs extract/delete action evidence explicit and generated.
- Type Docs delete responses at the Deck-facing boundary.
- Confirm GET Memory search uses one explicit degraded response write.
- Keep current Memory search unavailable semantics honest and visible.
- Keep mutating Memory dream actions deferred/skipped-safe rather than pretending
  real fixture coverage exists.
- Update durable notes, matrix rows, generated matrix Markdown, and head
  verification evidence.

**Non-Goals:**

- Do not add LanceDB-backed semantic search.
- Do not add docs soft-delete/archive policy.
- Do not implement docs editing, docs session picker, or GFM/highlight
  dependency decisions.
- Do not execute destructive Memory dreams actions against real operator memory.
- Do not add new Gateway methods or per-agent memory-dream params.

## Decisions

### Decision: Give Docs writes action-level mutation evidence

Docs extract can create local docs from session history, and Docs delete can
remove local docs. They are production-visible write flows, so they should be
known to the shared mutation evidence contract even if automated real mutation
fixtures remain skipped-safe.

Alternative rejected: keep all Docs writes hidden under the broad
`docs-memory-skills-devices` deferred class. That preserves safety but gives the
frontend no action-level metadata for visible Docs buttons.

### Decision: Keep Memory dreams as deferred/skipped-safe class-level evidence

The same `/api/memory/dreams` route multiplexes safe read and potentially
destructive actions. Current Gateway semantics do not expose per-agent params
for these operations. Until the product contract separates read from mutating
actions or proves disposable memory fixtures, class-level skipped-safe evidence
is the honest boundary.

Alternative rejected: add a single broad `memory.dreams` mutation action. That
would hide action-specific risk and produce weak target evidence.

### Decision: Keep GET Memory search single-response and degraded

Fresh source inspection shows the current GET search handler calls the shared
response writer once. This proposal keeps that behavior covered and leaves the
501 degraded response in place until a LanceDB adapter exists.

## Risks / Trade-offs

- **Risk:** Docs extract may return zero docs, leaving no target id.  
  **Mitigation:** Mutation evidence uses `extracted=present` for success and
  `docs.0.id` as best-effort target evidence when extraction creates a doc.

- **Risk:** Docs delete response shape differs between current 200, possible
  future 204, and current frontend 404-missing shim.  
  **Mitigation:** Define a tolerant `DeckGoDocDeleteResponse` used at the
  frontend boundary; the route target id remains authoritative for mutation
  evidence.

- **Risk:** Matrix rows may look "complete" while semantic search is still not
  implemented.  
  **Mitigation:** Completion means the degraded contract is explicit, not that
  LanceDB search exists.

## Migration Plan

1. Add Docs delete DTO and Docs extract/delete mutation evidence source.
2. Regenerate Deck API and mutation evidence artifacts.
3. Update Docs frontend facades and focused mutation/API tests.
4. Confirm GET Memory search single-response behavior and update focused
   backend tests if needed.
5. Update Docs/Memory notes, matrix rows, generated matrix Markdown, and head
   verification evidence.
6. Run focused contract, backend, frontend, build, OpenSpec, and diff checks;
   then archive this child proposal.

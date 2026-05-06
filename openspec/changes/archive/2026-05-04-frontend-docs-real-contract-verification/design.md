## Context

Docs already has production code and an archived hifi spec, but the handoff package now contains a newer v2 prototype. The module is not a static docs site; it is a Deck-local operational document registry populated by extracting long assistant messages from chat history.

The current contract chain is:

1. `frontend-new/src/api.ts` wrappers (`fetchDocs`, `fetchDoc`, `extractDocs`, `deleteDoc`)
2. Go BFF `/api/docs`, `/api/docs/{docId}`, `/api/docs/extract`
3. local document store (`backend/internal/localstore/docs.go`) and docs server/admin handlers
4. extraction path through managed runtime chat history for `POST /api/docs/extract`
5. `DeckGoDoc*` DTOs in `deck-go/contracts/source/deck-api.contract.ts`

## Goals / Non-Goals

**Goals:**

- Align production Docs with the fresh v2 handoff when the prototype is backed by the true contract.
- Preserve the existing BFF-only browser boundary and wrapper-first frontend architecture.
- Verify list, detail, local search/filtering, safe extract shape, safe delete shape, Markdown/rendering, production render, and BFF-only browser access with mock and real-stack evidence.
- Fix clear docs-scoped drift directly, including mismatches in docs, mocks, tests, wrappers, BFF route semantics, or frontend UI behavior.
- Record capability gaps in `frontend-handoff/modules/docs/implementation-notes.md`.

**Non-Goals:**

- Add a server-side docs search endpoint, vector search, document authoring/editing, version history, static docs site navigation, collaborative editing, ACL/retention policy UI, import/export, or a session picker.
- Introduce new frontend dependencies without explicit approval. The handoff claims `react-markdown + remark-gfm + rehype-highlight`, but this change must first verify current dependencies and must not add packages.
- Execute destructive real delete against user docs unless the E2E creates an ephemeral fixture and can restore or safely remove it.
- Claim real LLM extraction quality or production knowledge-base completeness from mock/local visual evidence.

## Decisions

1. **Code truth wins over prototype claims.** The v2 handoff is the visual/product target, but actual DTOs, BFF routes, local store behavior, and Gateway chat-history availability define production behavior.

2. **Docs remain a Deck-local registry.** The UI can explain provenance and local extraction, but it must not present the registry as a full enterprise knowledge base.

3. **Markdown fidelity is bounded by installed dependencies.** If the production workspace does not already include the handoff's Markdown stack, use the existing renderer or a module-local deterministic renderer and record the dependency gap.

4. **Delete stays confirmation-gated.** Real E2E should avoid deleting existing user docs. It may create a disposable doc through extract when possible; otherwise delete shape is skipped-safe or handoff-blocked.

5. **Real E2E uses safe shape checks.** L2 verification should cover route availability and UI render; extraction can use a known-safe session only when available. Empty docs or no extractable chat history is valid evidence when recorded.

6. **Circuit breaker applies to environment or state blockers.** If real Gateway state, chat history, or local docs corpus prevents a scenario after at most three fresh attempts, record the failure as empty-valid, degraded, skipped-safe, or handoff-blocked with evidence, then continue after static review and L1 evidence are complete.

## Risks / Trade-offs

- **Extraction depends on chat history state** -> Treat no extractable messages as empty-valid and keep mock visual extraction for UI behavior.
- **Delete is destructive** -> Prefer disposable fixtures or safe non-existent IDs in real tests.
- **Prototype overstates Markdown dependency state** -> Verify package.json before implementation; document any renderer gap instead of silently adding deps.
- **Doc list may inline content today** -> Keep detail route support because the contract allows list-without-content in the future.
- **OpenSpec archive can overwrite spec detail if delta is partial** -> Copy full modified requirement blocks into the delta spec before archive.

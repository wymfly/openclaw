## Context

Docs is the runtime-extracted document reader. Its current contract chain is:

`DocsPanel` -> `frontend-new/src/api.ts` wrappers -> Deck BFF routes:

- `GET /api/docs`
- `GET /api/docs/{docId}`
- `POST /api/docs/extract`
- `DELETE /api/docs/{docId}`

The BFF stores docs in the local doc registry and extracts candidate docs from
Gateway chat history via the managed runtime. The Deck-facing product contract
is therefore `DeckGoDoc`, not a direct Gateway docs API. The active prototype in
`frontend-handoff/modules/docs/prototype.html` is a two-pane workspace with a
category tree, document reader, command-style search overlay, keyword filtering,
source provenance, related docs, outline, extraction popover, and delete
confirmation.

The production implementation already follows this general v2 shape, but the
head matrix still records Docs as parity-unreviewed. This child must generate
the missing proof, patch deterministic drift, and upgrade real E2E to the
strengthened standard.

## Goals / Non-Goals

**Goals:**

- Confirm `frontend-handoff/modules/docs/prototype.html` is the active visual
  target and `prototype-v1-codex.html` is reference-only.
- Audit production Docs against the active v2 document reader prototype.
- Fix deterministic drift in layout, reader surfaces, search, keyword filters,
  extract/delete interactions, localized text, fixture data, or BFF wrappers
  when contract truth supports the prototype.
- Preserve BFF-only browser access for all Docs data and mutations.
- Attempt representative real fixture data by creating a run-scoped session
  through the real chat path and extracting docs through `POST /api/docs/extract`
  when chat seed succeeds.
- Cleanup any run-scoped real doc fixture with `DELETE /api/docs/{id}` and
  refuse cleanup for non-run-id docs.
- Upgrade mock visual E2E and real Gateway E2E to cover shell navigation,
  theme/locale variants, safe child surfaces, fixture evidence, and unexpected
  error checks.
- Update Docs implementation notes, matrix row, and head task `5.8`.

**Non-Goals:**

- Do not add a server-side docs search endpoint in this child.
- Do not add inline markdown editing, soft archive/bin, durable audit feed, or
  doc versioning.
- Do not introduce `react-markdown`, syntax-highlighting, or another markdown
  dependency.
- Do not mutate or delete non-run-scoped real user docs.
- Do not create a test-only docs seed endpoint.
- Do not edit generated contract artifacts unless a source contract fix
  requires regeneration.

## Decisions

### D1: Treat the current panel as candidate implementation

Production Docs already implements the core two-pane reader and BFF wrappers.
This child should compare it with the active prototype and patch concrete
deterministic gaps instead of rebuilding from the handoff files blindly.

Alternative considered: wholesale replacement from prototype files. Rejected
because production has already adapted the prototype to generated Deck DTOs,
i18n, the shared Markdown renderer, and BFF-only wrappers.

### D2: Real fixture data comes from chat extraction, not direct store writes

Docs real data should be created through the product path: run-scoped chat
session -> `POST /api/docs/extract` -> docs registry -> UI reader. Direct local
store writes or test-only seed routes would bypass the contract chain the module
is meant to verify.

Alternative considered: write docs directly into the local store. Rejected
because it validates renderer shape but not the Gateway/BFF extraction chain.

### D3: Delete cleanup is allowed only for run-scoped docs

Docs delete is a real mutation. E2E cleanup may delete docs only when the doc
content/title/provenance contains the current run id. If extraction produces no
doc, cleanup records empty-valid or skipped-safe evidence.

Alternative considered: delete the first available doc after the test. Rejected
because real stack may include user docs copied into the isolated state.

### D4: Current shared Markdown renderer remains accepted scope

The prototype includes an in-house richer markdown renderer. Production should
continue using the existing shared `MarkdownText` renderer unless a separate
dependency/design proposal approves a richer markdown pipeline.

Alternative considered: add a markdown dependency during parity remediation.
Rejected because the visual target can be met with the existing renderer and
new dependency choice is not required for this child.

## Risks / Trade-offs

- **Risk: real chat seed can fail due model/channel environment.** -> Attempt
  cpa/main seed with bounded retries, record handoff-blocked/degraded evidence,
  and still verify safe read/UI surfaces.
- **Risk: extraction can return zero docs if assistant content is too short.**
  -> Use a prompt designed to elicit a long markdown-like response; if still
  empty, record empty-valid and do not force a test-only seed.
- **Risk: delete cleanup could remove non-test data.** -> Require current run id
  in the doc before deletion.
- **Risk: standalone prototype differs from Deck shell chrome.** -> Treat shell
  chrome as an accepted exception when module panel parity otherwise matches.
- **Risk: renderer dependency gap affects code blocks/tables.** -> Record the
  existing shared renderer as the current production boundary and keep richer
  markdown as follow-up.

## Migration Plan

1. Audit prototype files, production Docs code, contract sources, BFF routes,
   mock visual spec, and real E2E spec.
2. Generate or inspect prototype-current parity evidence for the active v2 Docs
   target.
3. Patch deterministic UI, i18n, fixture, route, or test drift found by the
   audit.
4. Upgrade mock visual E2E to capture reader, search overlay, keyword filter,
   extract popover, delete confirmation, and localized theme variants.
5. Upgrade real E2E to verify route shapes, shell navigation, theme/locale
   axes, safe child interactions, BFF-only transport, unexpected errors, and
   run-scoped chat-extract-delete fixture evidence or skipped-safe circuit
   breaker.
6. Update implementation notes and the head matrix, validate, then archive this
   child proposal.

## Open Questions

- Whether future Docs should add a server-side search/index endpoint.
- Whether delete should become soft archive instead of hard local-store delete.
- Whether Docs should support inline editing and version history.
- Whether internal markdown links should route within Deck instead of opening
  as external links.
- Whether a richer markdown renderer dependency is justified after product
  behavior stabilizes.

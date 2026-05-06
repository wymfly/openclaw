## Context

The active logs handoff is a v2 multi-file React prototype for an operations log
workbench. It has a filter-rich stream pane on the left and a details pane on
the right. The current contract truth exposes typed `logs.tail` params/result
and Deck-facing `DeckGoLogsTailResponse.lines?: string[]`; stream event payload
leaves remain dynamic through `DeckGoLogStreamEvent.json`. The production
implementation already contains substantial v2 work: defensive parsing for
string tail lines, compatibility handling for older object-shaped fixtures,
local filters, live stream events, selection details, pause/resume, clear-local,
and export preview.

The current head remediation matrix still treats Logs as parity-unreviewed. This
child proposal closes that gap by comparing the active prototype against the
current production panel, reconciling contract truth, and proving the product
surface through mock and bounded real Gateway evidence.

## Goals / Non-Goals

**Goals:**

- Pin `prototype.html` as the active visual target and classify older prototype
  files as historical.
- Reconcile prototype behavior with Deck logs contracts: `GET /api/logs`,
  `GET /api/logs/stream`, typed string tail lines, dynamic stream envelopes,
  local filters, and parsed line details.
- Fix scoped deterministic implementation drift in UI, parser, fixtures, API
  wrappers, stream handling, contracts, backend adapters, or handoff docs.
- Produce strict mock prototype parity evidence and a structured verdict.
- Attempt bounded real Gateway evidence through the actual Deck shell, including
  theme/locale variants and meaningful child interactions.

**Non-Goals:**

- Do not implement durable log export/download.
- Do not add server-side filtering or search to Gateway/BFF contracts.
- Do not force `DeckGoLogLine` as a new canonical schema unless contract-chain
  source truth already supports it.
- Do not promote Logs-specific molecules into the design system in this child
  proposal.

## Decisions

### D1: `prototype.html` is active

The module README identifies `prototype.html` as the v2 visual target and
preserves `prototype-v1-codex.html` as historical. This pass uses the v2
prototype as visual/product input.

### D2: Typed tail rows stay string-first, stream payloads stay defensive

Production must treat current `logs.tail` truth as string rows while retaining
defensive parsing for older object-shaped fixtures and future richer rows. If the
prototype assumes a richer normalized line shape, production may match the UX by
parsing string text into local `ParsedLogEntry` records while preserving raw
payload inspection and documenting any schema gaps. Stream event `json` leaves
remain dynamic and must be parsed defensively.

### D3: Real E2E should not fabricate log rows

Real Logs evidence is read/stream oriented. It may verify empty, quiet, or sparse
real Gateway data as valid if the UI renders the appropriate empty state and no
browser direct-Gateway calls occur. Mock parity remains responsible for dense
visual states.

Safe real activity should still be triggered before accepting an empty/quiet
result. The test may call read-only Deck BFF routes or Gateway-backed operations
that naturally produce runtime activity, and it may use run-scoped identifiers
when an operation supports them. It must not inject synthetic rows into the Logs
panel or mutate non-isolated user/global state only to make the panel look busy.

### D4: Product-surface evidence must cover variants and child interactions

Real evidence must start from the Deck shell navigation, cover dark and light
themes, cover English and Chinese locale rendering, and interact with safe child
surfaces such as filters, row selection or empty-state behavior, details/raw
payload, pause/resume, clear-local, and export preview when data exists.

## Risks / Trade-offs

- **Risk: real Gateway stream is quiet** -> Mitigation: classify quiet timeout
  as `empty-valid` or `handoff-blocked` only after the tail route and UI render
  have been verified.
- **Risk: prototype assumes normalized fields not present in real string logs**
  -> Mitigation: keep parser/raw payload surfaces and document typed-line gaps.
- **Risk: dirty worktree triggers OpenClaw runtime rebuild and real-stack
  timeout** -> Mitigation: collect backend/Gateway diagnostic output and record a
  circuit-breaker handoff after bounded attempts.
- **Risk: export/download is mistaken for backend capability** -> Mitigation:
  keep export preview client-side and mark durable download as unsupported.

## Verification Strategy

- Run focused Logs frontend tests after implementation.
- Run focused backend/contract checks only if backend or contract files are
  touched.
- Run Logs mock visual E2E and generate a prototype-current comparison report.
- Write a structured visual verdict and accepted-exception ledger.
- Attempt Logs real Gateway E2E with shell navigation, theme/locale variants,
  child interactions, safe reads/stream reachability, and BFF-only browser
  transport.
- Run OpenSpec validates before archive.

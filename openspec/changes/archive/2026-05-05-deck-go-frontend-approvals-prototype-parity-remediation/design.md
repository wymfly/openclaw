## Context

The active approvals handoff is a v2 multi-file React prototype for a security
operations workbench: pending exec/plugin approval queue, selected approval
detail, decision bar, policy editor, and recent decision evidence. The current
production implementation already has substantial v2 migration work, but the
head remediation matrix still classifies approvals as only mock-functional and
strict parity-unreviewed.

Approvals is more sensitive than most panels because the natural real
workflows are mutations: resolving approvals and saving policy can affect active
operator state. This pass must therefore separate safe real evidence from
mutation evidence and avoid turning visual parity into unsafe live state
changes.

## Goals / Non-Goals

**Goals:**

- Pin `prototype.html` as the active visual target and classify older prototype
  files as historical.
- Compare active prototype behavior with the Deck approval contract chain:
  policy read/write, pending exec/plugin queues, decision routes, stream
  updates, and mutation evidence.
- Fix scoped deterministic implementation drift, including fixture shape,
  stream normalization, unsafe browser transport, visual structure, or handoff
  contract docs.
- Produce strict mock prototype parity evidence and a structured verdict.
- Attempt safe real Gateway evidence for read route shapes and UI rendering
  without direct browser Gateway calls.

**Non-Goals:**

- Do not create, resolve, or mutate real approvals/policy unless disposable
  fixtures and cleanup are proven.
- Do not implement new Gateway capabilities such as reason capture, bulk
  approval decisions, audit pagination, or typed summary KPIs.
- Do not promote approvals-specific molecules into the design system in this
  child proposal.

## Decisions

### D1: Treat mutations as evidence-limited unless fixtures are disposable

The real E2E pass may verify policy/pending/plugin read route shapes and UI
rendering. Exec/plugin decision and policy-save flows remain skipped-safe or
handoff-blocked unless a run-scoped fixture can be created and cleaned up.

### D2: Contract truth overrides prototype-only fields

Prototype-only reason submission, underscore decision values, plugin metadata
fields, and summary/audit projections are not production authority. Production
must use current Deck DTOs, hyphenated decision values, BFF routes, stream
contracts, and mutation evidence.

### D3: Visual parity targets structure, density, and hierarchy, not static data

The mock-current screenshot should preserve the v2 two-pane security workbench,
queue/detail decision flow, KPI/header hierarchy, policy editor affordance, and
recent evidence pattern. Static prototype sample counts, recent audit rows, and
local countdown values may differ if the difference is source-linked.

### D4: Real E2E must verify the product surface, not just approval RPCs

The real Gateway pass must use the actual Deck shell and prove that a user can
navigate into Approvals, exercise light and dark themes, exercise English and
Chinese locales, and interact with the major child surfaces that are safe in the
current environment. For Approvals this means queue/detail selection, policy UI
read rendering, stream connection state, and disabled/skipped-safe mutation
affordances when disposable approval fixtures are not available.

## Risks / Trade-offs

- **Risk: real Gateway pass cannot create pending approvals safely** →
  Mitigation: classify read route/UI evidence as passed and mutation execution
  as skipped-safe with explicit fixture follow-up.
- **Risk: prototype implies unsupported reason capture or audit projection** →
  Mitigation: record accepted exceptions and keep unsupported controls disabled
  or documented as follow-up.
- **Risk: stream shape differs across Gateway versions** → Mitigation: keep
  `useApprovalsStream` defensive, verify mock event behavior, and record real
  stream gaps separately from route/UI readiness.
- **Risk: theme/locale shell checks expose cross-module drift** → Mitigation:
  fix deterministic Approvals-owned defects in this proposal and record
  shared-shell defects against the head proposal rather than masking them.

## Context

`deck-go-panel-cockpit-design-system` promoted cockpit primitives from Sessions
and Usage into the existing design-system pattern layer. The follow-up
`deck-go-logs-cockpit-pattern-validation` validated the same API in Logs and
recorded that future modules may consume the cockpit pattern set module by
module when matching anatomy exists.

The remaining frontend panels still contain many local implementations of the
same visual structures: topbar/header stacks, KPI metric strips, status/pill
rows, and selected-detail hero surfaces. Evidence from the first three modules
does not justify global token changes or automatic migration of every module.
It does justify a governed rollout that first audits all panels, then groups
similar panels into batch proposals.

Stakeholders are deck-go frontend maintainers, reviewers of future OpenSpec
batch changes, and module owners who need to know whether their local panel
chrome is reusable cockpit structure or business-specific UI.

## Goals / Non-Goals

**Goals:**

- Establish one head proposal for cockpit rollout governance.
- Audit all `deck-go/frontend-new/src/components/panels/**` surfaces before
  implementation batches begin.
- Batch structurally similar panel migrations to avoid one proposal per module.
- Keep each batch reviewable by limiting it to 2-5 panels with shared anatomy.
- Preserve module-specific rows, charts, editors, detail panes, timelines,
  forms, raw payload renderers, and dangerous-write flows locally unless a
  separate reuse-analysis proposal promotes them.
- Provide program-level closure so "all modules converged" means every panel
  has evidence, not just that several high-visibility panels migrated.

**Non-Goals:**

- No broad JSX/CSS migration in the head change.
- No global token value, density default, or atom API changes.
- No backend, BFF, Gateway, generated contract, Data Fabric, or dependency
  changes.
- No new design-system pattern inside this program unless a later batch proves
  that the existing cockpit set is insufficient and opens a separate pattern
  proposal.
- No claim that mock visual evidence replaces real contract or real E2E
  evidence for data-path changes.

## Decisions

### Decision 1: Use a head change plus batch changes

The head change owns governance, inventory, classifications, batch sequencing,
and closure. It does not migrate panels directly. Each implementation batch
shall be a child/follow-up OpenSpec change that names the panel set, the shared
structures to migrate, local-only molecules, and focused verification.

Alternatives considered:

- One module per proposal: rejected because the repeated cockpit problem would
  create excessive proposal/test/document overhead.
- One proposal for all panels: rejected because it would mix unrelated business
  surfaces and make review/rollback impractical.
- Ad hoc migrations without a head change: rejected because program closure
  would become impossible to prove.

### Decision 2: Classify every panel before batching

The first implementation task is a read-only readiness audit. Each target panel
must be classified:

- `direct-fit`: root/header/status/KPI structures can consume existing cockpit
  patterns with minimal local compatibility CSS.
- `partial-fit`: some cockpit structures can migrate, but domain-specific hero,
  detail, editor, or row molecules must stay local.
- `needs-new-pattern`: repeated anatomy exists but the current cockpit API is
  insufficient; this requires a separate pattern proposal before migration.
- `stay-local`: the panel has no meaningful cockpit anatomy or is governed by a
  more specific surface contract.

The initial target inventory is every panel under
`deck-go/frontend-new/src/components/panels/`, with `chat` treated as a special
surface that can be audited but not forced through cockpit rollout.

Alternatives considered:

- Start with Budget/Alerts immediately: rejected for the head change because it
  would skip program inventory.
- Classify only visually broken panels: rejected because the user asked for all
  modules to converge, which requires explicit "not migrated" evidence too.

### Decision 3: Batch by anatomy, not navigation order

Batch proposals shall group panels by shared cockpit shape and risk profile, not
by left-nav order. The expected starting matrix is:

- Batch A candidates: Budget, Alerts, Threads. These have the closest
  header/KPI/status shape and likely qualify as `direct-fit`.
- Batch B candidates: Identity, Subagents, Channels. These have clear
  header/KPI/hero repetition but more module-specific detail hero and glyph/hash
  structures, so they likely qualify as `partial-fit`.
- Batch C candidates: Webhooks, Cron, Approvals. These are control/automation
  panels with topbar, pill rows, metrics, and guarded write flows.
- Batch D candidates: API Explorer, Gateway, Skills, Plugins, Nodes. These are
  larger panels that may expose whether a separate detail-hero or timeline
  pattern is needed.
- Special or deferred candidates: Chat, Settings, Config, Docs, and any panel
  whose current structure is governed by another surface-specific change.

These are seed groups, not final scope. The readiness audit can reassign panels
based on code evidence.

### Decision 4: Consume current cockpit patterns first

Batch changes shall prefer the existing `PanelRoot`, `PanelSectionHeader`,
`PanelStatusRow`, `PanelPill`, `KpiStrip`, `PanelMetric`, and `PanelSurface`
APIs. If a panel needs a shape outside that set, the batch should keep it local
or open a separate pattern proposal. It should not silently extend the pattern
API or add one-off escape hatches.

Alternatives considered:

- Add generic `DetailHero`, `MetricTile`, or `StatusTimeline` during the head
  change: rejected because those require their own reuse-analysis evidence from
  the readiness audit and at least two stable call sites.
- Allow `className` or `style` overrides on cockpit patterns: rejected because
  the current pattern contract intentionally prevents external style escape
  hatches.

### Decision 5: Verify each batch at module granularity

Each batch may share an OpenSpec proposal, but verification remains per module.
For each migrated panel, the batch shall include focused component/unit tests,
relevant mock visual or parity smoke, frontend build evidence, and updated
readiness documentation. Real Gateway E2E is required only if the batch changes
contract/data behavior; cockpit-only visual migrations should state why real
E2E is out of scope.

## Risks / Trade-offs

- **Risk: Batch scope becomes too broad.** Mitigation: cap normal batches at 2-5
  panels and require shared anatomy plus per-module verification.
- **Risk: Program inventory stalls implementation.** Mitigation: make the
  readiness audit a small, evidence-focused task with a matrix output rather
  than a design rewrite for every panel.
- **Risk: Visual similarity causes over-promotion.** Mitigation: classify
  local-only molecules explicitly and require separate pattern proposals for new
  shared APIs.
- **Risk: A migrated batch changes behavior while moving JSX.** Mitigation:
  require focused tests and keep data loading, mutation, and contract paths
  unchanged for cockpit-only batches.
- **Risk: "All modules converged" is claimed too early.** Mitigation: require
  program-level closure that checks every target panel and all deferred items.

## Migration Plan

1. Create the cockpit rollout head proposal with governance specs and tasks.
2. Implement the head change by producing a full readiness matrix and proposed
   batch map.
3. Create Batch A from the audited matrix, likely starting with Budget, Alerts,
   and optionally Threads if the evidence supports a direct fit.
4. After each batch lands, update the readiness matrix with migrated structures,
   local-only molecules, verification evidence, and any deferred pattern
   candidates.
5. Continue through later batches until every target panel is migrated,
   classified as stay-local, or deferred with an explicit follow-up.
6. Run program-level closure before claiming cockpit rollout is complete.

Rollback for the head change is documentation/spec-only. Rollback for later
batch changes shall be handled by reverting the batch-specific JSX/CSS changes;
no persisted data migration is involved.

## Open Questions

- Should the readiness matrix live inside the existing cross-module readiness
  document or as a separate cockpit rollout matrix linked from it?
- Should Batch A include Threads immediately, or should the first batch stay to
  Budget + Alerts only for faster visual feedback?
- Which panel should be the first `needs-new-pattern` candidate if the audit
  confirms repeated detail-hero/timeline anatomy?

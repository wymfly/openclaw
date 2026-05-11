## Context

The existing design-system pattern layer already defines a reuse-analysis gate:
new canonical patterns beyond the initial set require evidence from at least two
panels. Sessions and Usage now provide that evidence.

Sessions showed that a panel may need a scoped panel root typography/density
posture plus a more structured workbench chrome. Usage showed a separate but
overlapping problem: stale token aliases and missing panel-root font caused the
production page to diverge from its active prototype. After local fixes, both
modules point at the same reusable shapes:

- panel root typography and density
- bordered panel surfaces without nested decorative cards
- KPI/stat strips with label, value, and hint hierarchy
- section headings with optional meta/actions
- status/meta rows, pills, and selected-row chrome

The evidence does not prove that canonical token values are wrong. It proves
that cockpit-style panels need a small pattern layer that consumes canonical
tokens consistently.

Stakeholders are deck-go frontend maintainers, future module owners, and
reviewers who need stable visual parity gates before broad module migration.

## Goals / Non-Goals

**Goals:**

- Promote a small panel/cockpit pattern set that is justified by Sessions and
  Usage, without broad token rewrites.
- Use Sessions and Usage as reference consumers so the extracted API is grounded
  in real module needs.
- Add typed, token-only, accessible pattern implementations with renderer and
  axe coverage.
- Preserve existing module behavior, data loading, BFF contracts, and E2E
  workflows.
- Require one additional sampled module before claiming the pattern set is safe
  for broad migration.

**Non-Goals:**

- No canonical token value changes.
- No global density default change.
- No backend, Gateway, BFF, generated contract, or Data Fabric changes.
- No new npm dependency.
- No generic chart, quota rail, transcript export, compaction, or usage
  drilldown pattern in this pass.
- No bulk migration of every panel.

## Decisions

### Decision 1: Add cockpit patterns under the existing pattern layer

Add the new primitives under
`deck-go/frontend-new/src/design-system/patterns/` and export them through the
existing pattern barrel. They are patterns, not atoms, because they encode panel
layout/content hierarchy rather than single interactive controls.

Initial contracts:

- `PanelRoot`: typography, base color, line-height, letter-spacing, box sizing,
  and optional density class/prop.
- `PanelSurface`: bordered surface with tone and selected variants.
- `KpiStrip` / `PanelMetric`: responsive metric grid and metric tile hierarchy.
- `PanelSectionHeader`: title, eyebrow/hint, and actions slots.
- `PanelStatusRow` / `PanelPill`: compact meta rows and status pills.

Alternatives considered:

- Keep local CSS in Sessions and Usage: fast but repeats the same drift in the
  next module.
- Add only documentation and no components: avoids code churn but does not give
  later modules a stable import surface.
- Modify atoms such as `Card`, `Badge`, or `SectionHeader`: too broad; existing
  atoms already serve other surfaces and should remain backward-compatible.

### Decision 2: Preserve canonical tokens and move token consumption into patterns

The patterns SHALL consume existing `--ds-*` tokens and may introduce
pattern-local CSS variables only inside pattern selectors. They SHALL NOT change
`tokens/index.css` values or redefine global density defaults.

Alternatives considered:

- Change global token values toward Sessions/Usage: rejected because Usage's
  root cause was stale token consumption and missing font inheritance, not bad
  canonical values.
- Add a new global dashboard theme: rejected until a third module proves the same
  global need.

### Decision 3: Reference consumers migrate first, then sample a third module

Sessions and Usage are the reference consumers. The implementation should first
extract the pattern layer, then migrate the repeated CSS structures in those two
modules. A third module sample is required before follow-up work claims this
pattern set can replace module-local styling broadly.

Good third-module candidates are Budget, Models, or Activity because they share
dashboard/cockpit density and metric/surface structures. The final choice can be
made during implementation based on current visual drift and test cost.

Alternatives considered:

- Migrate all modules immediately: rejected because it would mix pattern
  extraction with unrelated product structure work.
- Stop after Sessions and Usage: rejected because it leaves the broad rollout
  question unanswered.

### Decision 4: Visual parity tests become pattern readiness gates

Reference consumers must keep module-level parity tests. These tests should
assert deterministic facts that matter to pattern extraction:

- `PanelRoot` typography and line-height
- canonical token values / no stale token aliases on primary paths
- key DOM areas and metric counts
- no horizontal overflow
- screenshot artifacts and structured verdict

Pixel acceptance remains human review. Machine verdicts should state DOM/token
score, not visual percentage.

Alternatives considered:

- Use screenshots only: too weak for root-cause prevention.
- Use unit tests only: too weak for layout and shell integration.

### Decision 5: Keep module-specific molecules local

Provider quota rails, usage charts, session transcript/export, compaction rows,
lineage rows, and usage drilldown details stay in their modules. They do not
have enough cross-module evidence and include domain-specific semantics.

Alternatives considered:

- Promote every repeated-looking card or row: rejected because visual similarity
  alone is not enough. Shared patterns need stable shape and stable semantics.

## Risks / Trade-offs

| Risk                                                               | Mitigation                                                                                                         |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Extracted patterns accidentally become too generic and hard to use | Keep the first API small, slot-based, and grounded in Sessions/Usage call sites.                                   |
| Pattern CSS overrides module intent                                | Use token-only styling and narrow pattern selectors; keep domain-specific molecules local.                         |
| Migration changes behavior while moving JSX                        | Require focused unit tests and existing visual/interaction E2E to pass for Sessions and Usage.                     |
| Third module sample expands scope                                  | Treat the third module as validation only. Do not redesign that module beyond replacing repeated primitive shapes. |
| Prototype screenshots remain dependent on handoff quality          | Keep production DOM/token/typography assertions deterministic and record human visual review separately.           |

## Migration Plan

1. Add pattern contracts and tests under `frontend-new/src/design-system/patterns/`.
2. Add Gallery examples for each pattern variant.
3. Migrate Sessions repeated surface/metric/header/status structures to the new
   patterns while preserving current behavior and parity evidence.
4. Migrate Usage repeated surface/metric/header/status structures to the new
   patterns while preserving current behavior and parity evidence.
5. Update the cross-module readiness matrix with Sessions and Usage reference
   consumer evidence.
6. Choose one third module and run a bounded validation slice. The slice may
   consume the new patterns but must not become a full product redesign.

Rollback is straightforward: the pattern files are additive, and reference
consumer migrations can be reverted independently. No persisted data or backend
contract changes are involved.

## Open Questions

- Which third module should be sampled first: Budget, Models, or Activity?
- Should `PanelRoot` expose a density prop, or should density remain purely CSS
  class/data-attribute driven?
- Should reference consumer parity artifacts be copied to a durable evidence
  directory instead of relying on Playwright output paths?

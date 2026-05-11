## 1. Program Baseline

- [ ] 1.1 Re-read `deck-go-panel-cockpit-design-system`, `deck-go-logs-cockpit-pattern-validation`, accepted `design-system-patterns`, and accepted `design-system-cross-module-readiness`.
- [ ] 1.2 Enumerate all target panels under `deck-go/frontend-new/src/components/panels/`, with `chat` marked as a special surface rather than an automatic cockpit migration target.
- [ ] 1.3 Create or update the cockpit rollout readiness matrix with columns for classification, matching cockpit anatomy, local-only molecules, suggested batch, verification scope, and blockers.

## 2. Readiness Audit

- [ ] 2.1 Audit each target panel's TSX and CSS for root/header/topbar, status/pill rows, KPI/metric strips, panel surfaces, selected-detail heroes, and stale local token aliases.
- [ ] 2.2 Classify every panel as `direct-fit`, `partial-fit`, `needs-new-pattern`, or `stay-local`, with file references or handoff evidence.
- [ ] 2.3 Identify local-only molecules that must not be promoted during cockpit rollout.
- [ ] 2.4 Identify candidate new patterns that require a separate reuse-analysis proposal rather than silent extraction.

## 3. Batch Plan

- [ ] 3.1 Produce a batch map grouping panels by shared anatomy and risk, starting from Budget/Alerts/Threads, Identity/Subagents/Channels, Webhooks/Cron/Approvals, and API Explorer/Gateway/Skills/Plugins/Nodes candidate groups.
- [ ] 3.2 For each proposed batch, define the panels in scope, cockpit structures to migrate, structures explicitly out of scope, and the narrow verification commands expected.
- [ ] 3.3 Mark any panel that should remain local or defer to another surface-specific OpenSpec change.

## 4. Governance Documentation

- [ ] 4.1 Update cross-module readiness with the program matrix and link this head change.
- [ ] 4.2 Record that global token value changes, atom API changes, and new shared patterns remain separate proposals.
- [ ] 4.3 Record the child-change protocol for future batches, including per-module evidence requirements and program closure expectations.

## 5. Verification

- [ ] 5.1 Run `openspec validate deck-go-panel-cockpit-rollout-program --type change --strict`.
- [ ] 5.2 Run `git diff --check` for this head change and touched readiness docs.
- [ ] 5.3 Confirm no frontend runtime files, backend files, generated contracts, dependency manifests, or global token values were changed by the head change.

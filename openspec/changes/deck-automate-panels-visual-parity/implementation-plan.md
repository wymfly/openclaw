# Implementation Plan

This plan is the OpenSpec-local execution handoff for `deck-automate-panels-visual-parity`.

Planning artifacts:

- PRD: `.omx/plans/prd-deck-automate-panels-visual-parity.md`
- Test spec: `.omx/plans/test-spec-deck-automate-panels-visual-parity.md`
- Non-Playwright evidence checklist: `openspec/changes/deck-automate-panels-visual-parity/parity-checklists.md`
- Backend gap ledger: `openspec/changes/deck-automate-panels-visual-parity/backend-gaps.md`

## Consensus Outcome

Use panel-local component decomposition inside the existing Vite Automate entries. Old Deck is the visual/interaction authority; current Go/Gateway APIs remain the runtime authority.

Scheduler is folded into the current Cron surface for this worktree as a merge-safety mapping. This is not a permanent product information-architecture decision.

## Architect Review Applied

The first Architect review returned `ITERATE`. Applied changes:

- Added hard boundaries for backend/shared/shell gaps.
- Elevated panel-local work to a hard non-goal boundary.
- Added `parity-checklists.md` as the required non-Playwright evidence artifact.
- Clarified Scheduler-in-Cron as a worktree mapping, not a final IA decision.
- Required unsupported runtime capability states instead of frontend fakes.

Planner/Critic follow-up was completed in the main thread after child-agent timeouts; the final plan satisfies the ralplan checklist: principles, decision drivers, options, ADR, staffing guidance, launch hints, and concrete verification path.

## Execution Order

1. Cron/Scheduler
   - Extract old-equivalent `JobList`, `JobForm`, `RunHistory`, `RunNowButton`, `NextExecutionCountdown`, and `HeartbeatConfig`.
   - Preserve current cron API payloads and render heartbeat config unavailable/read-only unless backed.
   - Complete the Cron/Scheduler checklist entries.

2. Webhooks
   - Extract old-equivalent `WebhookForm`, `DeliveryHistory`, and sidebar/detail view structure.
   - Preserve create/edit/delete/test/delivery API behavior.
   - Complete the Webhooks checklist entries.

3. Approvals
   - Extract old-equivalent pending/plugin/policy/path allowlist components and stream hook.
   - Preserve all policy, approval, plugin approval, navigation, and realtime semantics.
   - Add tests before changing sensitive policy/action behavior.
   - Complete the Approvals checklist entries.

4. Skills
   - Extract old-equivalent list/hub/info/config/matrix/install dialog components.
   - Preserve current skill, hub, install, update, and agent-matrix payloads.
   - Complete the Skills checklist entries.

5. Cross-panel i18n and style pass
   - Remove hardcoded Automate panel copy.
   - Add only Automate-local EN/ZH keys.
   - Restore old-equivalent layout density using existing primitives first.

6. Verification
   - Run targeted Automate panel tests.
   - Run frontend build.
   - Run OpenSpec strict validation.
   - Run diff check.
   - Do not run Playwright E2E in this worktree.

## Verification Commands

```bash
cd deck-go/frontend && npm run test:deck-ui -- src/components/panels/cron/CronPanel.test.tsx src/components/panels/webhooks/WebhooksPanel.test.tsx src/components/panels/approvals/ApprovalsPanel.test.tsx src/components/panels/skills/SkillsPanel.test.tsx
cd deck-go/frontend && npm run build
openspec validate deck-automate-panels-visual-parity --strict
git diff --check -- openspec/changes/deck-automate-panels-visual-parity deck-go/frontend/src/components/panels/cron deck-go/frontend/src/components/panels/webhooks deck-go/frontend/src/components/panels/approvals deck-go/frontend/src/components/panels/skills deck-go/frontend/src/i18n/en.json deck-go/frontend/src/i18n/zh.json
```

## Execution Handoff

Sequential:

```text
$ralph openspec/changes/deck-automate-panels-visual-parity .omx/plans/prd-deck-automate-panels-visual-parity.md .omx/plans/test-spec-deck-automate-panels-visual-parity.md
```

Parallel team:

```text
$team implement openspec/changes/deck-automate-panels-visual-parity with lanes: cron-scheduler, webhooks, approvals, skills, verifier
```

Team lanes:

- `executor`: Cron/Scheduler
- `executor`: Webhooks
- `executor`: Approvals
- `executor`: Skills
- `verifier`: after implementation, validate tests/build/OpenSpec/checklists and confirm Playwright deferral

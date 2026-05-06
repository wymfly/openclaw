## Context

Skills differs from Plugins: Skills has installed inventory, hub search/detail,
configuration, install/update actions, and an agent skill matrix. The active
handoff prototype presents that as a catalog product, while current production
mixes installed list, selected skill, hub detail, and matrix in a dense
two-column workbench.

Existing contract surfaces are useful and should be preserved:

- `fetchSkills` for `GET /skills`;
- `updateSkill` for `PATCH /skills/{skillKey}`;
- `installSkill` for `POST /skills/install`;
- `fetchSkillHubBins`, `searchSkillHub`, `fetchSkillHubDetail`,
  `installSkillHub`, and `updateSkillHub` for `/skills/hub`;
- `fetchAgentSkills` and `updateAgentSkills` through `/deck/agents` actions.

## Decisions

### D1: Product shell follows the active prototype, not the old workbench

Production should start with an Installed/Hub catalog list. Detail, config,
install, and matrix capabilities remain reachable, but the first viewport should
match the prototype's operator workflow.

### D2: Contract truth constrains projections

Triggers, files, audit history, managed-bin removal, and synchronous hub install
progress are prototype/product projections unless current DTOs guarantee them.
The UI may show empty or projected states, but must not fabricate stable Gateway
capabilities.

### D3: Real E2E writes are attempted only when isolated

Real Skills writes can touch installed skills, workspace files, or hub-managed
bins. The real test should first prove a disposable workspace/config target. If
safe fixture creation cannot be proven after bounded attempts, the test records
skipped-safe or degraded evidence while still verifying real read surfaces,
navigation variants, detail interactions, and BFF-only transport.

### D4: Agent skill matrix remains secondary

The agent matrix is product-useful and contract-backed, but it is not the
primary visual target for this remediation. It should move behind a secondary
section/tab/dialog if necessary to preserve parity without losing capability.

## Risks

- **Unsafe real writes:** mitigated by isolation checks, run-id guardrails, and
  skipped-safe circuit breakers for install/update paths.
- **Prototype overreach:** unsupported projections are accepted exceptions or
  unavailable states.
- **Large UI rewrite:** scoped to the Skills panel and verified with unit,
  mock visual, parity report, real E2E, and build.

## Implementation Plan

1. Audit the active Skills prototype, current production UI, contract wrappers,
   and existing mock/real tests.
2. Implement prototype-shaped list/detail/dialog flow over existing DTOs.
3. Update mock Gateway fixture density and focused unit tests.
4. Strengthen mock visual and real Gateway Playwright evidence.
5. Record accepted exceptions and evidence in implementation notes and the
   remediation matrix.
6. Validate, archive, and mark head task `5.3` complete.

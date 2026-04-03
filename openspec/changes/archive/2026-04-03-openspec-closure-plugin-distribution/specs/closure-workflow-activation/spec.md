## ADDED Requirements

### Requirement: Manual skill activation SHALL remain a stable cross-product entrypoint

Users SHALL be able to explicitly activate the closure workflow on both supported products using the same skill contract.

#### Scenario: Manual activation runs closure lifecycle through bundled assets

- **scenario_id**: `closure-workflow-activation.manual-skill-entrypoint`
- **WHEN** a user explicitly asks to use `openspec-closure-workflow`
- **THEN** the agent SHALL discover the bundled closure executable and companion assets from the installed product bundle
- **AND** it SHALL use that bundled executable to perform `init`, `report`, or `check` rather than assuming project-local scripts exist

### Requirement: Wrapper workflow skills SHALL only route into closure workflow behavior

Higher-level workflow skills may invoke closure workflow behavior, but they SHALL NOT duplicate companion logic.

#### Scenario: Workflow wrappers route without redefining closure rules

- **scenario_id**: `closure-workflow-activation.wrapper-routing-only`
- **WHEN** a higher-level workflow such as `codex-workflow`, `codex-dev-workflow`, `dev-workflow`, or `openspec-workflow` routes into closure handling
- **THEN** it SHALL delegate to `openspec-closure-workflow`
- **AND** it SHALL NOT independently redefine scenario inventory rules, verification status semantics, or archive readiness logic

### Requirement: Activation failures SHALL produce bootstrap guidance

When a target project has not yet adopted the required adapter files, activation SHALL fail with actionable next steps.

#### Scenario: Missing adapter produces bootstrap guidance

- **scenario_id**: `closure-workflow-activation.bootstrap-guidance`
- **WHEN** `openspec-closure-workflow` is activated inside a project that lacks `.openspec-closure.yaml` or equivalent adapter state
- **THEN** the agent or wrapper SHALL surface actionable bootstrap guidance
- **AND** it SHALL NOT terminate with a raw missing-file stack trace alone

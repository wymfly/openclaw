## ADDED Requirements

### Requirement: Projects SHALL keep closure adoption to a thin adapter surface

Project-local integration SHALL be limited to configuration and change artifacts, not a copy of the companion core.

#### Scenario: Project-owned files stay limited to adapter and change artifacts

- **scenario_id**: `closure-project-bootstrap.thin-project-surface`
- **WHEN** a project adopts the pluginized closure companion
- **THEN** the required repo-owned files SHALL be limited to items such as `.openspec-closure.yaml`, plan `covers.id`, and `openspec/changes/<change>/verification.yaml`
- **AND** the project SHALL NOT be required to vendor the closure parser, checker, or report formatter source files

#### Scenario: Archive gates can consume machine-readable readiness without vendored checker code

- **scenario_id**: `closure-project-bootstrap.archive-gate-machine-output`
- **WHEN** a project wants to wire closure readiness into local scripts, CI, or archive gating
- **THEN** it SHALL be able to consume machine-readable readiness output from the installed closure bundle
- **AND** it SHALL NOT need to fork or embed the checker implementation just to get `archiveReady`

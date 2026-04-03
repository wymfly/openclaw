# closure-openclaw-consumer-boundary Specification

## Purpose
TBD - created by archiving change openspec-closure-repo-extraction. Update Purpose after archive.
## Requirements
### Requirement: OpenClaw SHALL retain only consumer-facing closure assets

After migration, OpenClaw SHALL behave as a consumer of external closure tooling rather than as the tooling's source repository.

#### Scenario: Consumer adapter stays in OpenClaw

- **scenario_id**: `closure-openclaw-consumer-boundary.keep-consumer-adapter`
- **WHEN** OpenClaw consumes closure tooling from an external sibling repository or installed plugin
- **THEN** it SHALL retain only project-owned consumer assets such as `.openspec-closure.yaml` and change-local `verification.yaml`
- **AND** any retained local guidance SHALL describe consumption of the external tooling rather than local ownership of the tooling implementation

#### Scenario: Tooling-only repo surfaces are removed from OpenClaw

- **scenario_id**: `closure-openclaw-consumer-boundary.remove-tooling-surfaces`
- **WHEN** migration is complete
- **THEN** OpenClaw SHALL remove repo-local closure executables, tooling packages, plugin bundles, generic tests, generic fixtures, generic plugin docs, and package-manager scripts that exist only to build or distribute the tooling
- **AND** OpenClaw SHALL stop presenting those surfaces as part of its own product repository

#### Scenario: OpenClaw remains a valid external consumer

- **scenario_id**: `closure-openclaw-consumer-boundary.external-consumer-validation`
- **WHEN** the tooling source has moved out of OpenClaw
- **THEN** the sibling repository's closure tooling SHALL still be able to run against OpenClaw as an external consumer repository
- **AND** OpenClaw SHALL NOT need to restore the migrated tooling sources in order to participate in the closure workflow


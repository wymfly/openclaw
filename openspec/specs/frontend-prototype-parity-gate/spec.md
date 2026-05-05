# frontend-prototype-parity-gate Specification

## Purpose

TBD - created by archiving change deck-go-frontend-prototype-parity-gate. Update Purpose after archive.

## Requirements

### Requirement: Parity gate generates comparison artifacts

The deck-go frontend parity gate SHALL generate prototype-current comparison
artifacts for active modules.

#### Scenario: Gate runs for a module with screenshots

- **WHEN** the gate is run with an active prototype screenshot and a mock-current
  screenshot for a module
- **THEN** it SHALL produce a side-by-side comparison artifact and a
  machine-readable verdict entry for that module.

### Requirement: Gate distinguishes missing evidence

The parity gate SHALL mark missing prototype screenshots, missing mock-current
screenshots, and failed visual specs as missing evidence instead of silently
passing.

#### Scenario: Mock visual spec fails before screenshot

- **WHEN** the primary mock-current screenshot for a module is absent
- **THEN** the generated verdict entry SHALL mark the module as missing current
  evidence
- **AND** SHALL NOT classify the module as visually aligned.

### Requirement: Visual spec repair keeps evidence level explicit

Mock visual specs repaired by this change SHALL remain labeled as mock
functional coverage unless they perform prototype comparison and write a
structured verdict.

#### Scenario: Visual spec only opens and screenshots a page

- **WHEN** the spec asserts page content and saves screenshots
- **THEN** it SHALL be documented as mock functional coverage
- **AND** separate parity gate artifacts SHALL be required for prototype
  alignment.

### Requirement: Current known failing specs are repaired

The shared parity gate change SHALL repair deterministic failures in the current
`api-explorer`, `approvals`, and `logs` mock visual specs.

#### Scenario: Full mock visual suite runs after gate repair

- **WHEN** the full `deck-go/test/e2e/*-visual.spec.ts` suite runs against the
  bundled mock stack
- **THEN** `api-explorer`, `approvals`, and `logs` SHALL no longer fail due to
  stale method counts or missing ready-state text when the underlying mock data
  is valid.

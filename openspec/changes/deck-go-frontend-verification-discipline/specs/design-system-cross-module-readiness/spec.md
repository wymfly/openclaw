## ADDED Requirements

### Requirement: Token readiness SHALL require mirror and panel namespace checks

Design-system readiness SHALL require both token mirror consistency and panel CSS variable namespace inventory. `scripts/check-tokens-drift.sh` SHALL pass, and panel-level non-`--ds-*` token references SHALL be fixed or tracked as explicit exceptions before closure is claimed.

#### Scenario: Token mirror check passes

- **WHEN** `bash scripts/check-tokens-drift.sh` is run from `deck-go/`
- **THEN** it SHALL exit 0 before token readiness is claimed
- **AND** the implementation evidence SHALL record the command.

#### Scenario: Panel has non-ds token references

- **WHEN** a panel under `frontend-new/src/components/panels/<module>/` references `var(--*)` outside the `--ds-*` namespace
- **THEN** the token inventory SHALL report the module and token names
- **AND** closure SHALL either rename the tokens to canonical `--ds-*` values or record a tracked exception with owner and reason.

#### Scenario: Token exception is temporary

- **WHEN** a non-`--ds-*` token is accepted temporarily
- **THEN** the exception SHALL include module, file, token name, reason, owner, and follow-up change or removal condition.

### Requirement: Panel a11y readiness SHALL be measured separately from atom a11y

Design-system atom axe coverage SHALL NOT be used as a substitute for panel-level a11y coverage. Frontend module readiness SHALL report atom a11y coverage and panel a11y coverage as separate counts.

#### Scenario: Atom a11y is complete but panel a11y is sparse

- **WHEN** atom tests import the axe helper but most panel tests do not
- **THEN** the readiness report SHALL state the atom count and panel count separately
- **AND** SHALL NOT report overall a11y as complete.

#### Scenario: Panel adds a11y coverage

- **WHEN** a panel adds axe or equivalent a11y coverage
- **THEN** the inventory SHALL count that panel as covered
- **AND** the panel test evidence SHALL be included in closure notes.

### Requirement: Unused shared primitives SHALL be adopted, removed, or classified

Shared frontend primitives SHALL NOT be treated as design-system or cross-module readiness progress unless production panels adopt them or they are explicitly classified. If a shared primitive directory has tests but zero panel consumers, readiness SHALL record whether to adopt, remove, or keep as an experimental follow-up.

#### Scenario: Shared list primitives have zero panel consumers

- **WHEN** `frontend-new/src/components/shared/lists/*` exists and no panel imports its exports
- **THEN** the readiness inventory SHALL report zero panel usage
- **AND** closure SHALL classify the primitives as `adopt-now`, `remove-now`, or `keep-experimental-follow-up`.

#### Scenario: Shared primitive is kept as follow-up

- **WHEN** unused primitives are classified as `keep-experimental-follow-up`
- **THEN** the classification SHALL include a reason, owner, and follow-up trigger
- **AND** future reports SHALL NOT describe the primitives as already adopted.

### Requirement: Component decomposition concerns SHALL be classified separately from hard protocol violations

Large single-file panels SHALL be reported as maintainability concerns unless a specific protocol requirement or module proposal requires decomposition. They SHALL NOT be used as hard closure blockers without a linked requirement.

#### Scenario: Panel is single-file but no decomposition requirement exists

- **WHEN** a panel has one production `.tsx` file and current protocol does not require splitting it
- **THEN** the readiness report SHALL classify the issue as maintainability follow-up
- **AND** SHALL NOT mark it as a protocol violation.

#### Scenario: A decomposition follow-up is created

- **WHEN** maintainability evidence justifies splitting a panel
- **THEN** a separate proposal SHALL define the target module boundaries and verification
- **AND** this verification-discipline change SHALL remain focused on facts and closure gates.

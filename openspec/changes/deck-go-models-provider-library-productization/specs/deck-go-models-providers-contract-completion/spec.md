## ADDED Requirements

### Requirement: Models completion SHALL prove provider-library product workflows

Models contract completion SHALL include evidence for provider-library,
configured-provider, custom-provider, and custom-model workflows rather than only
raw Models config CRUD.

#### Scenario: Models workflow is production-visible

- **WHEN** the Models module is visible in the frontend
- **THEN** completion evidence SHALL prove the main page shows configured
  providers with their nested models
- **AND** provider-library template workflows SHALL be reachable through Add
  Provider instead of occupying the main page or a duplicate management drawer.

#### Scenario: Provider-library workflow is production-visible

- **WHEN** a provider-library template, configured provider, or mixed
  catalog-plus-configured provider is visible in the Models UI
- **THEN** completion evidence SHALL identify the DTO/source truth used by the
  frontend
- **AND** it SHALL prove that unsupported template mutation actions are not
  offered.

#### Scenario: Custom-provider workflow is production-visible

- **WHEN** the custom-provider workflow is visible in the Models UI
- **THEN** completion evidence SHALL include component or E2E proof that clicking
  the blank custom option reaches the configuration path
- **AND** it SHALL include proof that selecting a provider template copies
  editable provider defaults and selectable default models
- **AND** it SHALL include typed BFF or real-safe evidence for the authored
  provider write path.

#### Scenario: Custom-model workflow is production-visible

- **WHEN** custom model authoring is visible in the Models UI
- **THEN** completion evidence SHALL prove the model write targets an authored
  configured provider
- **AND** template-only providers SHALL be converted or guarded before model
  mutation.

### Requirement: Models handoff SHALL not contradict implemented product semantics

Models handoff and prototype notes SHALL be updated or annotated when they
describe raw catalog mode choices or template mutation behavior that no longer
matches the implemented Provider Library product model.

#### Scenario: Handoff contains raw mode-first UI

- **WHEN** a handoff artifact shows `merge` / `replace` as the primary Models
  product decision
- **THEN** it SHALL be updated, annotated as stale, or linked to the current
  Provider Library implementation notes.

#### Scenario: Handoff contains unsupported catalog mutation

- **WHEN** a handoff artifact implies built-in providers can be installed,
  uninstalled, or edited in place
- **THEN** it SHALL be updated or annotated to clarify that authored
  `openclaw.json` provider config is the writable surface.

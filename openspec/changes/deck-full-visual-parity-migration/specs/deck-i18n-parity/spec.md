## ADDED Requirements

### Requirement: Panel-local copy switches language

All visible Vite Deck panel-local UI copy SHALL switch between English and Chinese when the locale changes.

#### Scenario: Locale switch on a migrated panel

- **WHEN** a user switches from English to Chinese on any migrated desktop panel
- **THEN** panel titles, section headings, descriptions, buttons, inputs, placeholders, tabs, empty states, errors, tooltips, and dialog copy SHALL render Chinese text where old Deck provided Chinese equivalents.

### Requirement: Acceptable untranslated text is explicit

The migration SHALL distinguish acceptable untranslated strings from missing translations.

#### Scenario: Copy audit finds English after Chinese switch

- **WHEN** the Chinese locale is active and visible English text remains
- **THEN** the migration evidence SHALL classify each string as a proper noun, API identifier, code/method name, token/user data, or a translation defect.

### Requirement: i18n parity is part of visual completion

A panel SHALL NOT be considered visually migrated if its local visible copy remains mostly English after locale switching.

#### Scenario: Nav labels translate but panel body does not

- **WHEN** nav labels translate but the panel body remains in English
- **THEN** the panel SHALL remain incomplete for this change.

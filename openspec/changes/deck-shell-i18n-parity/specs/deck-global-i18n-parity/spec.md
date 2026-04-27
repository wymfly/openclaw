## ADDED Requirements

### Requirement: Visible copy is locale-aware

All visible Vite Deck shell and shared primitive copy SHALL be rendered through the Deck i18n provider unless the text is a proper noun, API identifier, code, method name, token, or user-provided data.

#### Scenario: Chinese locale selected

- **WHEN** Chinese locale is active
- **THEN** shell controls, shared primitive labels, dialogs, errors, empty states, buttons, placeholders, and tooltips SHALL display Chinese copy where old Deck had Chinese copy.

### Requirement: Copy audit blocks visual parity

Every visual parity child change SHALL include a copy audit for its panel set.

#### Scenario: English panel body remains after locale switch

- **WHEN** the panel body remains primarily English after switching to Chinese
- **THEN** that panel SHALL NOT be marked visually complete.

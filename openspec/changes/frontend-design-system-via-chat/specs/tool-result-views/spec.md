## MODIFIED Requirements

### Requirement: Show Raw toggle

Every enhanced tool result view SHALL provide a segmented control with tabs for `raw`, `bash`, `read`, and `diff` views, replacing the previous binary "Show Raw" / "Show Formatted" toggle. The `raw` tab serves as the universal fallback that surfaces the original unprocessed content; the other tabs are enabled only when their corresponding view type is detectable.

#### Scenario: Segmented control replaces binary toggle

- **WHEN** an enhanced tool result view (bash split, diff, syntax-highlighted read, etc.) renders its header
- **THEN** the header SHALL display a segmented control listing `raw`, `bash`, `read`, `diff` tabs in this fixed order
- **AND** the control SHALL NOT be replaced by a single toggle button

#### Scenario: Inapplicable tabs are visibly disabled

- **WHEN** the result content does not match the input shape required by a tab (e.g., no bash output for `bash` tab)
- **THEN** that tab SHALL be rendered in a disabled visual state at the same position
- **AND** SHALL NOT be hidden, so the segmented control stays positionally stable across messages

#### Scenario: Default active tab is the detected best view

- **WHEN** the result has detectable structure (bash output, file content, or diff)
- **THEN** the corresponding tab SHALL be the default active tab
- **AND** the `raw` tab SHALL remain available as an explicit fallback

#### Scenario: Raw fallback always available

- **WHEN** no specialized view applies to the result
- **THEN** the `raw` tab SHALL be the default active tab
- **AND** the `bash`, `read`, `diff` tabs SHALL be disabled

#### Scenario: Toggle to raw view via tab

- **WHEN** the user clicks the `raw` tab on a formatted tool result
- **THEN** the card SHALL immediately switch to displaying the original `content` string in a monospace pre block

#### Scenario: Toggle back to formatted view via tab

- **WHEN** the user clicks the previously-active formatted tab (e.g., `bash`) from the `raw` view
- **THEN** the card SHALL return to that detected formatted view (bash/diff/highlighted)

#### Scenario: Persistence within session

- **WHEN** the user changes the active tab on a specific tool result card
- **THEN** that card SHALL retain its tab selection until explicitly changed; other cards SHALL not be affected

#### Scenario: Error state preserves segmented control

- **WHEN** a tool result is in error state (`isError: true`)
- **THEN** the segmented control SHALL remain visible
- **AND** the error tinting SHALL apply to the card chrome, not by collapsing the control
- **AND** the default active tab SHALL be `raw` to surface the underlying error message verbatim

## ADDED Requirements

### Requirement: Segmented control uses design-system primitive

The tool-result segmented control SHALL be implemented through the `SegmentedControl` atom from `frontend-design-system`, not a tool-result-specific bespoke component.

#### Scenario: SegmentedControl is sourced from design-system

- **WHEN** a tool-result card renders its tab control
- **THEN** the implementation SHALL import `SegmentedControl` from `@/design-system`
- **AND** SHALL NOT define a private segmented control specific to tool-result rendering

#### Scenario: Tab a11y is provided by atom

- **WHEN** the segmented control is interacted with via keyboard
- **THEN** Tab/Shift-Tab SHALL move focus into and out of the control
- **AND** ArrowLeft/ArrowRight SHALL move selection between enabled tabs
- **AND** the active tab SHALL set `aria-selected="true"` and the inactive tabs `aria-selected="false"`
- **AND** disabled tabs SHALL set `aria-disabled="true"` and SHALL be skipped by arrow key navigation

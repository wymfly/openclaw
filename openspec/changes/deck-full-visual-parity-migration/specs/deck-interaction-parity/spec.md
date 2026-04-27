## ADDED Requirements

### Requirement: Old Deck interactions are migration inputs

The Vite Deck frontend SHALL preserve old Deck interaction semantics for desktop navigation, panel state, tabs, dialogs, lists, forms, and Chat affordances unless a documented Go/Gateway constraint requires a difference.

#### Scenario: Old panel uses tabs or dialogs

- **WHEN** an old Deck panel uses tabs, dialogs, wizard steps, inline edit, batch actions, or section navigation
- **THEN** the corresponding Vite panel SHALL migrate those interactions or document why the Gateway-backed product no longer supports them.

### Requirement: Global shell interactions match old Deck

The Vite Deck shell SHALL preserve old Deck interactions for sidebar collapse, mobile overlay behavior when applicable, panel shortcuts, theme switching, locale switching, gateway status navigation, suspense/error feedback, and command surfaces.

#### Scenario: User uses global keyboard shortcut

- **WHEN** the user activates a panel shortcut supported by old Deck
- **THEN** Vite Deck SHALL navigate to the same panel identity unless a documented panel inventory decision removed it.

### Requirement: Chat interactions match old Deck

The Vite Chat panel SHALL preserve old Deck interactions for session selection, agent tabs, input history, slash commands, mentions, approval dialogs, right panel modes, transcript search, block filters, tool result actions, subagent lineage, and streaming status.

#### Scenario: Chat action exists in old Deck

- **WHEN** an old Deck Chat action is available from a visible icon, menu, tab, dialog, or keyboard affordance
- **THEN** Vite Chat SHALL provide the same action or a documented equivalent in the same workflow.

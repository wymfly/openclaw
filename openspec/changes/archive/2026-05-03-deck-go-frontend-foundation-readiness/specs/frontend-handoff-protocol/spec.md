## ADDED Requirements

### Requirement: Translation rules SHALL include the prototype string rule

`frontend-handoff/CLAUDE.md` Translation rules section SHALL include a subsection named "Prototype string rule" stating that prototype files (`frontend-handoff/modules/<x>/*`) hardcode display strings and never call `t()` / `useTranslations` / next-intl, while engineering implementation in `frontend-new/src/components/panels/<x>/` extracts to i18n in a single pass at translation time. Detailed scenarios SHALL be governed by the `frontend-prototype-strings-convention` capability.

#### Scenario: Designer authors a new prototype and reads the protocol

- **WHEN** a designer opens `frontend-handoff/CLAUDE.md` before authoring `frontend-handoff/modules/<new>/`
- **THEN** the Translation rules section SHALL surface the prototype string rule with a brief example of correct hardcoded text vs incorrect mock-`t()` usage
- **AND** the rule SHALL link to the `frontend-prototype-strings-convention` spec for full normative requirements

#### Scenario: Reviewer rejects a prototype using mock i18n

- **WHEN** a prototype PR includes `const t = (k) => k;` or imports from a next-intl shim
- **THEN** the reviewer SHALL cite the protocol's Translation rules → Prototype string rule
- **AND** the PR SHALL be updated to remove the mock and inline the strings

### Requirement: Patterns and icons SHALL be sourced from design-system, not invented panel-locally

`frontend-handoff/CLAUDE.md` SHALL state that cross-module shells (PageShell / NavRail / TopBar / EmptyState / KbdHint / SectionHeader and any future canonical patterns) and icons (every visual icon used across modules) SHALL be sourced from `frontend-new/src/design-system/patterns/` and `frontend-new/src/design-system/icons/` respectively. Prototypes SHALL reference these by name in their `components.md` rather than inventing equivalents.

A prototype that needs a shell or icon not yet in the design system SHALL either (a) propose its addition through `design-system/proposals/` and wait, or (b) implement it as a panel-local molecule with an explicit note in `implementation-notes.md` flagging it as a reflowback candidate.

#### Scenario: Prototype lists its dependencies in components.md

- **WHEN** a designer writes `frontend-handoff/modules/<x>/components.md`
- **THEN** the file SHALL list dependencies under "Depends on canonical patterns" naming the exact pattern names (e.g., `PageShell`, `EmptyState`)
- **AND** the file SHALL list dependencies under "Depends on canonical icons" naming the exact icon export names (e.g., `IconAgent`, `IconStream`)

#### Scenario: Prototype invents a panel-local shell

- **WHEN** a prototype implements a custom `module-page-shell` instead of using `PageShell`
- **THEN** the module's `implementation-notes.md` SHALL flag this as a deliberate divergence with reasoning
- **AND** the divergence SHALL appear in the next quarterly reflowback review for promotion or removal

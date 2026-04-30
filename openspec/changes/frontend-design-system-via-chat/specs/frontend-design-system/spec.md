## ADDED Requirements

### Requirement: Design system directory exists with declared structure

The deck-go frontend SHALL provide a shared design system directory at `deck-go/frontend/src/design-system/` containing tokens, atomic components, and utility hooks. This directory SHALL be the only authoritative source for shared visual primitives consumed by panels.

#### Scenario: Directory structure matches contract

- **WHEN** the design-system directory is inspected
- **THEN** it SHALL contain subdirectories `tokens/`, `atoms/`, and `hooks/`
- **AND** SHALL expose a top-level `index.ts` that re-exports all public atoms and hooks
- **AND** SHALL NOT contain any panel-specific code (no chat-only / settings-only logic)

#### Scenario: Token CSS is imported once

- **WHEN** the deck-go frontend boots
- **THEN** `deck-go/frontend/src/theme.css` SHALL `@import` design-system tokens at the top
- **AND** no panel SHALL re-import design-system token CSS independently

### Requirement: Token namespace and naming rules

The design system SHALL define design tokens as CSS custom properties with a stable, layered naming convention covering color, spacing, typography, density, and radius.

#### Scenario: Color tokens follow semantic-slot + intensity convention

- **WHEN** a panel uses a color token
- **THEN** the token name SHALL match one of the documented slots: `--bg-0..3` (surface depth), `--bg-elev`, `--bg-hover`, `--bg-active`; `--text-1..4` (primary to disabled); `--accent` / `--accent-dim` / `--accent-bg`; `--success` / `--success-bg`; `--warn` / `--warn-bg`; `--error` / `--error-bg`; `--border-subtle` / `--border` / `--border-strong`; `--code-bg` / `--code-border`; `--diff-add` / `--diff-add-text` / `--diff-del` / `--diff-del-text`; `--cursor`
- **AND** SHALL NOT use raw hex, rgb, or hsl values for colors that have a token equivalent

#### Scenario: Theme switching via data attribute

- **WHEN** `data-theme="dark"` or `data-theme="light"` is set on `<html>` or `<body>`
- **THEN** the same token names SHALL resolve to theme-appropriate values defined in design-system tokens.css
- **AND** all panels SHALL render correctly in both themes without panel-specific overrides

#### Scenario: Density switching via data attribute

- **WHEN** `data-density="comfortable"` or `data-density="compact"` is set on `<html>`
- **THEN** the tokens `--row-h`, `--line`, `--fs-body`, `--fs-code`, `--fs-meta` SHALL adjust to the corresponding density preset
- **AND** atomic components consuming these tokens SHALL visibly tighten/loosen accordingly (button heights, padding, icon sizes — not just text)

### Requirement: Atomic component inventory

The design system SHALL provide the following atomic components, each as a standalone TypeScript module under `design-system/atoms/`:

- Container atoms: `Card`, `Block`, `Drawer`, `Modal`
- Text atoms: `Markdown`, `Code`, `DiffView`, `JsonTree`, `TableView`
- Status atoms: `Badge`, `Chip`, `Tag`, `Spinner`, `SkeletonLoader`, `Banner`
- Form atoms: `Input`, `Textarea`, `Select`, `Toggle`, `Radio`, `Slider`, `FileInput`
- Navigation atoms: `Tab`, `SegmentedControl`, `Breadcrumb`, `SidebarRow`
- Action atoms: `Button` (primary/secondary/ghost/danger variants), `IconButton`, `DropdownMenu`, `Popover`
- Overlay atoms: `Tooltip`, `Toast`, `ContextMenu`
- Streaming atoms: `StreamingCursor`, `WaitingDots`, `ProgressBar`

#### Scenario: Atom is self-contained

- **WHEN** an atom is imported into a panel
- **THEN** the atom SHALL render correctly without requiring panel-specific CSS overrides
- **AND** the atom's props interface SHALL fully type-control its visible variants (no className escape hatch for variant selection)

#### Scenario: Atom variants use props not className strings

- **WHEN** a panel needs a variant of an atom (e.g., a danger Button)
- **THEN** the panel SHALL select the variant via a typed prop (e.g., `<Button variant="danger">`) NOT a className override

### Requirement: Atomic component a11y baseline

Every atomic component SHALL meet baseline accessibility requirements suitable for inclusion in a production application.

#### Scenario: Interactive atoms are keyboard reachable

- **WHEN** any interactive atom (Button, IconButton, Tab, Toggle, etc.) is rendered
- **THEN** it SHALL be focusable via Tab key
- **AND** SHALL show a visible focus indicator (outline or ring) on focus
- **AND** SHALL respond to Enter/Space activation when applicable

#### Scenario: Toggle atoms expose pressed state

- **WHEN** a `Toggle`, `Tab`, or `SegmentedControl` item is rendered with an active state
- **THEN** it SHALL set `aria-pressed`, `aria-selected`, or `aria-current` as appropriate

#### Scenario: Live regions announce dynamic content

- **WHEN** a `Banner`, `Toast`, or live-updating overlay (such as countdown timer) is rendered
- **THEN** it SHALL set `aria-live` to `polite` or `assertive` as appropriate
- **AND** SHALL use semantic HTML (`<output>`, `role="status"`, `role="alert"`) where applicable

#### Scenario: Modal atoms trap focus

- **WHEN** a `Modal` opens
- **THEN** focus SHALL move to the modal content
- **AND** Tab navigation SHALL stay within the modal until closed
- **AND** Escape key SHALL close the modal and return focus to the triggering element

### Requirement: Atomic component i18n contract

The design system SHALL NOT hardcode user-facing strings; all text SHALL be supplied by callers via props.

#### Scenario: Atom text comes from props

- **WHEN** an atom needs to render any user-facing text (button label, badge text, placeholder, tooltip content)
- **THEN** the text SHALL be supplied by the caller via a typed prop
- **AND** the atom SHALL NOT contain hardcoded English (or any locale) text

#### Scenario: Atom defaults reference i18n keys when applicable

- **WHEN** an atom has an inevitable default label (e.g., Modal close button)
- **THEN** the default SHALL be sourced from an i18n key passed as prop, with no inline string fallback

### Requirement: CSS namespace and authoring rules

CSS class names exposed by the design system SHALL use the `ds-` prefix and follow a documented authoring convention.

#### Scenario: All design-system classes use ds- prefix

- **WHEN** a design-system atom emits CSS classes
- **THEN** every emitted class SHALL be prefixed with `ds-` (e.g., `ds-button`, `ds-button--danger`, `ds-block__head`)
- **AND** SHALL NOT collide with the legacy `deck-ui-*` namespace

#### Scenario: No inline hex in component CSS

- **WHEN** the design-system CSS is parsed
- **THEN** no atom's CSS file SHALL contain raw hex/rgb/hsl color values
- **AND** all colors SHALL reference tokens via `var(--<name>)`

### Requirement: Panel consumption discipline

Panels (chat / settings / models / channels / sessions / gateway-panel) SHALL consume design-system primitives exclusively for shared visual concerns.

#### Scenario: Panel imports atoms from design-system

- **WHEN** a panel needs a shared atom (Button, Card, Badge, etc.)
- **THEN** the panel SHALL import from `@/design-system` (or relative path `../../design-system`)
- **AND** SHALL NOT define a private equivalent

#### Scenario: Panel-specific styling stays in panel

- **WHEN** a panel needs unique visual treatment not covered by design-system
- **THEN** the panel MAY add its own scoped CSS using a panel-specific class prefix (e.g., `chat-` for chat panel)
- **AND** SHALL NOT extend the `ds-` namespace
- **AND** the panel SHALL document why an atom did not suffice (so future generalization can be considered)

### Requirement: Utility hooks for shared interaction patterns

The design system SHALL provide utility hooks for interaction patterns reused across atoms and panels.

#### Scenario: Required hooks are exported

- **WHEN** the design-system index.ts is inspected
- **THEN** it SHALL export at minimum: `usePopover`, `useFocusTrap`, `useKeyboardNav`, `useEscapeClose`, `useClickOutside`
- **AND** each hook SHALL be a typed React hook with documented props and return values

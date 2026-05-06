# design-system-patterns Specification

## Purpose

Define the canonical cross-module pattern layer for `deck-go/frontend-new`:
small, typed layout and content shells that sit above atoms and below business
panels. The spec protects pattern file structure, barrel imports, token-only
styling, slot-based APIs, accessibility tests, and the reuse-analysis gate for
any seventh-or-beyond pattern.

## Requirements

### Requirement: patterns/ directory exists with flat-file structure

`deck-go/frontend-new/src/design-system/patterns/` SHALL exist as a sibling of `atoms/` and `hooks/`. Each pattern SHALL be stored as `<Pattern>.tsx + <pattern>.css` (flat structure, kebab-case CSS file matching PascalCase TSX), NOT as `<Pattern>/<Pattern>.tsx + .module.css + index.ts` triplets.

The directory SHALL include `index.ts` as the public barrel that re-exports every pattern and its types. Patterns NOT exported from the barrel are considered private and MUST NOT be imported across module boundaries.

#### Scenario: A panel imports a pattern

- **WHEN** a panel under `frontend-new/src/components/panels/<x>/` imports a pattern
- **THEN** the import path SHALL be `@/design-system/patterns` (the barrel) OR `@/design-system` (the top-level barrel)
- **AND** the panel SHALL NOT reach into a specific file path under `patterns/` (no `@/design-system/patterns/PageShell` direct imports)

#### Scenario: A pattern adds CSS

- **WHEN** the engineering implementer ships a new pattern
- **THEN** its CSS file SHALL live next to the TSX file with the kebab-case name (e.g., `PageShell.tsx` + `page-shell.css`)
- **AND** the CSS file SHALL be imported via side-effect inside the TSX file
- **AND** the CSS SHALL only reference `--ds-*` tokens for color, spacing, radius, and shadow

### Requirement: Six initial patterns SHALL exist

The first canonical patterns SHALL be: `PageShell`, `NavRail`, `TopBar`, `EmptyState`, `KbdHint`, `SectionHeader`. Each SHALL ship with TSX implementation, scoped CSS file, type exports from the barrel, vitest renderer test, and `vitest-axe` accessibility test asserting `await expect(container).toHaveNoViolations()`.

Each pattern SHALL be reachable from the design system Gallery (`?dsGallery=1`) so reviewers can see all variants without writing throwaway harnesses.

#### Scenario: PageShell renders a view container

- **WHEN** a panel renders `<PageShell>{...}</PageShell>`
- **THEN** the rendered DOM SHALL include a `max-width` constraint, padding, and a fade-in animation under 250ms
- **AND** the shell SHALL accept `children` as the only required prop

#### Scenario: NavRail provides module navigation

- **WHEN** a parent renders `<NavRail items={[...]} activeId="agents" onSelect={...} />`
- **THEN** each item SHALL render as a clickable element with appropriate `aria-current` when active
- **AND** the rail SHALL be 64px wide on desktop and collapse / hide responsively below 760px viewport

#### Scenario: TopBar exposes global actions and command palette entry

- **WHEN** a parent renders `<TopBar brand="OpenClaw Deck" actions={...} onCommandPaletteOpen={...} />`
- **THEN** the bar SHALL render brand, slot for actions, and a ⌘K hint button
- **AND** the ⌘K hint button SHALL announce its keyboard shortcut via `aria-keyshortcuts`

#### Scenario: EmptyState renders icon + title + body + CTA

- **WHEN** a parent renders `<EmptyState icon={...} title="..." description="..." action={<Button>Create</Button>} />`
- **THEN** the rendered DOM SHALL place the icon above the title, with description below, and the optional action at the bottom
- **AND** the wrapper SHALL include `role="status"` for neutral / search variants and `role="alert"` for error variant

#### Scenario: KbdHint renders keyboard shortcut chips

- **WHEN** a parent renders `<KbdHint keys={["⌘", "K"]} />`
- **THEN** each key SHALL render in its own chip element with monospace font and 1px border
- **AND** consecutive keys SHALL be separated by 3px gap with no `+` glyph

#### Scenario: SectionHeader renders h2 + hint + actions

- **WHEN** a parent renders `<SectionHeader title="Identity" hint="backend-supported fields" actions={<Button>Save</Button>} />`
- **THEN** the title SHALL render as `<h2>` for document outline correctness
- **AND** the hint SHALL render with mono font and `text-3` color
- **AND** actions SHALL right-align in the same row

### Requirement: patterns/ uses tokens only and exposes typed slot props

Every pattern SHALL satisfy two API rules:

- **Tokens-only rule**: All visual values (color, spacing, radius, shadow, font) SHALL come from `--ds-*` tokens. No hex literals, no raw px values for spacing other than mathematical computations on token-derived values.
- **Slot composition rule**: When a pattern accepts content, the prop SHALL be a `ReactNode` slot (e.g., `children`, `actions`, `footer`, `icon`), NOT a configuration object. Variants SHALL be a discriminated string union (e.g., `tone?: "neutral" | "search" | "error"`), NOT free-form className passthrough.

Patterns MAY accept HTML standard props (`role`, `aria-*`) as passthrough but MUST NOT accept `className` or `style` overrides from external callers. Internal styling decisions stay encapsulated.

#### Scenario: A panel tries to override pattern styling

- **WHEN** a panel renders `<EmptyState className="my-custom" />` or `<EmptyState style={{padding: 100}} />`
- **THEN** the pattern's TypeScript signature SHALL reject this prop
- **AND** the recommended path SHALL be to wrap the pattern in a panel-local container or to extend the pattern's variant union via a follow-up proposal

#### Scenario: A pattern's CSS uses a hex literal

- **WHEN** code review or `pnpm check` runs on a pattern's CSS file
- **THEN** the file SHALL contain zero hex literals or rgb() literals (only `var(--ds-*)` references and computed `color-mix()` over tokens)
- **AND** any violation SHALL fail the local-check gate

### Requirement: New pattern proposals MUST follow the reuse-analysis gate

Adding any seventh-or-beyond canonical pattern to `frontend-new/src/design-system/patterns/` SHALL require a written proposal at `frontend-handoff/design-system/proposals/<YYYY-MM-DD>-pattern-<name>.md`. The proposal MUST:

- Identify ≥ 2 panels (in `frontend-handoff/modules/<x>/` or `frontend-new/src/components/panels/<x>/`) that exhibit the same shell shape
- Name the closest existing pattern and explicitly justify why extending it is impossible (props budget exceeded, behavior fundamentally different, etc.)
- Get sign-off from Claude Code (the engineering owner of `frontend-new/`) before any code lands

Single-panel needs SHALL stay as panel-local molecules and wait for the second occurrence.

#### Scenario: Designer requests a new ConfirmDialog pattern after one panel uses it

- **WHEN** a designer proposes `ConfirmDialog` at `design-system/proposals/2026-06-01-pattern-confirm-dialog.md` citing only the agents delete dialog
- **THEN** the proposal SHALL be returned with the request to wait for the second panel that needs the same shape
- **AND** the agents delete dialog SHALL remain a panel-local component until that second occurrence

#### Scenario: A second panel demonstrably needs a confirm dialog with the same shape

- **WHEN** the channels panel and the agents panel both ship confirm dialogs with avatar + destructive-action structure
- **THEN** a follow-up proposal SHALL include both call sites and a single proposed API
- **AND** Claude Code SHALL evaluate whether to add the new canonical `ConfirmDialog` pattern in a separate change

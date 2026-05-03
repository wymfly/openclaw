# design-system-icons Specification

## Purpose

TBD - created by archiving change deck-go-frontend-foundation-readiness. Update Purpose after archive.

## Requirements

### Requirement: icons/ directory exists and re-exports from lucide-react

`deck-go/frontend-new/src/design-system/icons/` SHALL exist as a sibling of `atoms/`, `hooks/`, and `patterns/`. The directory SHALL contain `index.ts` as the canonical icon barrel and `README.md` documenting the lucide-react → semantic name mapping.

`lucide-react` SHALL be the only icon source for canonical exports. The barrel SHALL re-export icons under deck-go domain semantic names (e.g., `IconAgent`, `IconStream`, `IconSession`) rather than lucide's anatomical names (`User`, `Radio`, `Clock`). Each export SHALL be accompanied by a comment indicating the underlying lucide source name.

Direct imports from `lucide-react` in `frontend-new/` outside of `design-system/icons/index.ts` SHALL be forbidden. Patterns and panels SHALL only import from `@/design-system/icons`.

#### Scenario: A panel renders an icon

- **WHEN** the agents panel renders `<IconAgent />`
- **THEN** the import SHALL come from `@/design-system/icons`
- **AND** the panel SHALL NOT contain `import { User } from "lucide-react"` directly
- **AND** the rendered DOM SHALL be a tree-shakeable lucide SVG, not an inline `<svg>` block

#### Scenario: A new icon is added

- **WHEN** a new domain term is needed (e.g., `IconRoute` for the routing panel)
- **THEN** the maintainer SHALL pick the closest lucide icon and add the wrap export to `design-system/icons/index.ts`
- **AND** the README mapping table SHALL be updated in the same commit
- **AND** existing semantic names SHALL NOT be repurposed

### Requirement: Icon exports SHALL stay tree-shakeable

The icons barrel SHALL re-export named lucide icons individually (`export { Search as IconSearch } from "lucide-react"` style) — NEVER `export * from "lucide-react"`. The Vite production build with `pnpm build` SHALL show only the icons actually consumed by panels in the output bundle.

A regression test SHALL verify that an empty consumer (importing nothing from icons) produces zero icon bytes in the bundle.

#### Scenario: Bundle audit after icons rollout

- **WHEN** `pnpm build` runs after a panel imports `IconAgent` and `IconStream`
- **THEN** the resulting bundle SHALL contain only those two lucide icons' SVG paths, not the entire lucide library
- **AND** the bundle delta vs the pre-icon baseline SHALL be reported (target ≤ 1 KB per icon after gzip)

#### Scenario: A future maintainer adds a barrel-wide re-export

- **WHEN** a PR contains `export * from "lucide-react"` in `design-system/icons/index.ts`
- **THEN** the change SHALL be rejected at code review
- **AND** the icons barrel guard test SHALL fail in CI if such a wildcard re-export is detected

### Requirement: Icons are documented and accessible

Every icon export from `design-system/icons/index.ts` SHALL be:

- Listed in `design-system/icons/README.md` with deck-go semantic name → lucide source name → 1-line usage hint
- Visible in the design system Gallery (`?dsGallery=1`) as a swatch grid with name labels
- Wrapped to expose `aria-label` / `aria-hidden` props for accessibility (decorative vs informative use)

Icons used in clickable controls SHALL pair with `aria-label` on the parent control or with their own non-empty `aria-label`. Icons SHALL default to `aria-hidden="true"` when no label is provided.

#### Scenario: A button has an icon-only affordance

- **WHEN** an icon button renders `<IconButton aria-label="Delete agent"><IconTrash /></IconButton>`
- **THEN** the inner `<IconTrash />` SHALL render with `aria-hidden="true"` by default
- **AND** the parent button SHALL carry the readable label

#### Scenario: An icon conveys standalone meaning

- **WHEN** a status indicator renders `<IconCheck aria-label="Saved" />`
- **THEN** the wrap exposes the explicit `aria-label` to screen readers
- **AND** the lucide-rendered SVG inherits the role-image semantics

### Requirement: Icon library decision is locked in stack-decisions

`docs/project/stack-decisions.md` SHALL list `lucide-react` under the Locked section once this change archives. The entry SHALL include:

- Decision: `Icons → lucide-react`
- Version: pinned to the version in `package.json` at first land
- Trigger to revisit: only if bundle-size becomes the bottleneck (≥ 30 KB icon-only delta) OR if a panel needs an icon lucide does not provide (in which case wrap a custom SVG behind the same `IconX` semantic name without removing lucide)

The Pending entry for icons SHALL be removed in the same commit.

#### Scenario: Reading stack-decisions after this change archives

- **WHEN** any agent reads `docs/project/stack-decisions.md` after archive
- **THEN** the agent SHALL find `Icons → lucide-react` in the Locked table
- **AND** the agent SHALL NOT find any Pending entry for icon library

#### Scenario: A future panel cannot find a suitable lucide icon

- **WHEN** the api-explorer panel needs a uniquely styled icon not in lucide
- **THEN** a custom SVG SHALL be added at `design-system/icons/_custom/<icon-name>.tsx` and exported under the same `IconX` semantic name
- **AND** the README SHALL note "custom (not lucide)" for that entry
- **AND** lucide-react SHALL remain the locked default

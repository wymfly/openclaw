# design-system / patterns

Cross-module layout shells. Sits between atoms (single-purpose primitives) and panels (business surfaces).

## Why this exists

Atoms are too narrow (Button / Input / Card don't compose into a "view shell"). Panels are too wide (each module would re-implement the same scaffold otherwise). Patterns capture the recurring shapes — page chrome, navigation rail, empty states, section headers, keyboard hints — so panels stay focused on data and behavior.

## v1 patterns

| Pattern         | Purpose                                                                                                    | Layer     |
| --------------- | ---------------------------------------------------------------------------------------------------------- | --------- |
| `PageShell`     | Centered max-width container with consistent padding and entrance animation. Wraps every panel.            | top-level |
| `NavRail`       | 64px-wide vertical module navigation. Hidden below 760px viewport.                                         | shell     |
| `TopBar`        | 48px chrome with brand, optional ⌘K command palette entry, and right-aligned actions.                      | shell     |
| `EmptyState`    | Centered no-data placeholder with icon + title + description + CTA. Tones: `neutral` / `search` / `error`. | content   |
| `KbdHint`       | Visible keyboard shortcut chips. No `+` glyph; gap implies sequence.                                       | inline    |
| `SectionHeader` | `<h2>` + hint + actions. Used inside detail panels, modal bodies, form sections.                           | content   |

## Inclusion gate

Adding a 7th-or-beyond pattern requires:

1. **≥ 2 panels** demonstrating the same shell shape (in `frontend-handoff/modules/<x>/` or `frontend-new/src/components/panels/<x>/`).
2. **Reuse analysis** in a proposal at `frontend-handoff/design-system/proposals/<YYYY-MM-DD>-pattern-<name>.md`:
   - Closest existing pattern
   - Why extension is impossible (props budget, behavior fundamentally different, etc.)
3. **Sign-off from the engineering owner** (`frontend-new/`).

Single-panel needs stay panel-local until the second occurrence. Don't promote prematurely.

See `openspec/specs/design-system-patterns/` for the full normative requirements.

## API rules

1. **Tokens-only**: All visual values (color, spacing, radius, shadow, font) come from `--ds-*` tokens. No hex literals, no raw px outside the spacing scale.
2. **Slot composition**: Content props are `ReactNode` slots (`children`, `actions`, `footer`, `icon`). Variants are discriminated string unions (`tone?: "neutral" | "search" | "error"`). No free-form `className` passthrough.
3. **No external style overrides**: Patterns do NOT accept `className` or `style` props from callers. Internal styling decisions stay encapsulated.
4. **Stateless**: Patterns receive state via props; they never own routing, fetching, or persistence.

## File structure

Flat structure matching atoms:

```
patterns/
├── PageShell.tsx + page-shell.css
├── NavRail.tsx + nav-rail.css
├── TopBar.tsx + top-bar.css
├── EmptyState.tsx + empty-state.css
├── KbdHint.tsx + kbd-hint.css
├── SectionHeader.tsx + section-header.css
├── index.ts                    ← public barrel
├── README.md                   ← this file
└── __tests__/
    ├── PageShell.test.tsx
    ├── NavRail.test.tsx
    ├── TopBar.test.tsx
    ├── EmptyState.test.tsx
    ├── KbdHint.test.tsx
    └── SectionHeader.test.tsx
```

Each pattern: TSX implementation + scoped CSS file + named export from `index.ts` + render+a11y test. CSS files reference only `--ds-*` tokens (verified by `pnpm check`).

## Usage

```tsx
import {
  PageShell,
  NavRail,
  TopBar,
  EmptyState,
  KbdHint,
  SectionHeader,
} from "@/design-system/patterns";
import { IconAgent, IconStream, IconPlus } from "@/design-system/icons";

function App() {
  return (
    <div className="app-grid">
      <NavRail
        items={[
          { id: "agents", icon: <IconAgent size={18} />, label: "Agents", onClick: ... },
          { id: "streams", icon: <IconStream size={18} />, label: "Streams", onClick: ... },
        ]}
        activeId="agents"
      />
      <main>
        <TopBar brand="OpenClaw Deck" onCommandPaletteOpen={() => ...} />
        <PageShell>
          <SectionHeader
            title="Agents"
            description="Configure agent identity and runtime policy."
            actions={<button>{<IconPlus />} New agent</button>}
          />
          <EmptyState
            icon={<IconAgent size={28} />}
            title="No agents yet"
            description="Create the first agent to get started."
            action={<button>{<IconPlus />} Create agent</button>}
          />
        </PageShell>
      </main>
    </div>
  );
}
```

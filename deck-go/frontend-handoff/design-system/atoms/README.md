# atoms/ — Atom design intent

> Per-atom design source: prototype + notes for each atom in the design system.
> The **canonical** implementation lives at `../../../frontend/src/design-system/atoms/<Atom>/`.
> This directory holds the design agent's intent and history.

## Per-atom layout

```
atoms/<AtomName>/
├── prototype.html      ← runnable visual + interaction reference
├── notes.md            ← purpose, variants, props, when to use vs not
└── v2.html, v3.html… ← (optional) revision forks, if redesigning
```

## notes.md template

```markdown
# <AtomName>

## Purpose

<1 sentence. What is this atom for?>

## Variants

- `primary` / `secondary` / `ghost` — when to use each
- `size: sm | md | lg`
- `disabled`, `loading`, `with-icon`, …

## Props (design intent)

- `variant: 'primary' | 'secondary' | 'ghost'` (default: 'primary')
- `size: 'sm' | 'md' | 'lg'` (default: 'md')
- `icon?: ReactNode`
- `disabled?: boolean`
- `loading?: boolean`
- `onClick?: () => void`

## Tokens consumed

- `--ds-accent-500` (primary fill)
- `--ds-text-on-accent`
- `--ds-radius-md`
- `--ds-space-3` (horizontal padding)

## When to use

- Primary action in a form or dialog
- ...

## When not to use

- Inline within prose — use a link instead
- ...

## Accessibility notes

- Must have visible focus ring (uses `--ds-accent-500` outline)
- `aria-busy` when loading
- ...
```

## Lifecycle

1. **Propose** — design agent creates `<Atom>/prototype.html` + `notes.md`, drops a memo in `../proposals/`
2. **Implement** — Claude Code productionizes to `../../../frontend/src/design-system/atoms/<Atom>/`
3. **Reference** — once productionized, the production `.tsx` is canonical; this directory becomes design history
4. **Revise** — if changing, fork to `v2.html`, file new proposal, repeat

## Current atoms

(none yet — will populate as DS implementation begins)

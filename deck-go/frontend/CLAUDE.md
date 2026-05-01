# frontend/ — Real Engineering Workspace

> **The actual Vite + React + TypeScript app.** This is what gets deployed.
> Maintained by **Claude Code**. The design agent (this Claude) only **reads** here for context.

---

## Who maintains what

| Surface | Owner | Notes |
|---|---|---|
| `src/design-system/tokens/` | Claude Code | Single source of truth for colors / spacing / radii / type. Design agent **proposes** changes via `frontend-handoff/`; Claude Code applies. |
| `src/design-system/atoms/` | Claude Code | TS component library (Button, Input, Tag, …). Design agent reads as reference. |
| `src/design-system/molecules/` | Claude Code | Composite components (Toolbar, DataTable, …). |
| `src/design-system/patterns/` | Claude Code | Cross-module layout patterns (ListShell, EmptyState). |
| `src/components/panels/<module>/` | Claude Code | Business modules. Design agent does not write here. |
| `src/{stores,api,hooks,lib,generated}/` | Claude Code | Data + logic. Design agent does not write here. |
| `src/i18n/`, `messages/` | Claude Code | Translations. |
| `tests/` | Claude Code | Vitest + Playwright. |
| `vite.config.ts`, `tsconfig.json`, `package.json` | Claude Code | Build & deps. |

The design agent never writes inside `frontend/`. It writes in **`../frontend-handoff/`** (sibling directory), and Claude Code reads from there to update `frontend/`.

---

## Architecture at a glance

```
frontend/
├── CLAUDE.md                          ← this file
├── package.json                       ← Vite + React 18 + TS
├── tsconfig.json
├── vite.config.ts
├── index.html                         ← Vite entry
├── messages/                          ← react-i18next bundles
│   ├── en.json
│   └── zh.json
├── tests/                             ← Vitest unit + Playwright e2e
└── src/
    ├── main.tsx                       ← entry
    ├── App.tsx                        ← root + router
    ├── routes/                        ← React Router v6 route modules
    │
    ├── design-system/                 ★ shared visual layer
    │   ├── tokens/
    │   │   ├── tokens.css             ← single source: --ds-* CSS variables
    │   │   ├── reset.css              ← minimal CSS reset
    │   │   └── index.ts               ← re-exports for runtime access
    │   ├── atoms/                     ← Button, Input, Tag, Avatar, Icon, …
    │   │   └── <Atom>/
    │   │       ├── <Atom>.tsx
    │   │       ├── <Atom>.module.css
    │   │       └── index.ts
    │   ├── molecules/                 ← Toolbar, DataTable, FormField, …
    │   ├── patterns/                  ← ListShell, EmptyState, ConfirmDialog, …
    │   ├── icons/                     ← SVG icon set (lucide subset or custom)
    │   └── index.ts                   ← barrel export
    │
    ├── components/
    │   └── panels/                    ← business modules
    │       ├── chat/                  ← existing
    │       │   ├── ChatPanel.tsx
    │       │   ├── chat-shell.module.css
    │       │   ├── components/        ← module-local components
    │       │   ├── hooks/
    │       │   └── types.ts
    │       └── <new-module>/
    │
    ├── stores/                        ← zustand stores
    │   ├── chat.ts
    │   ├── session.ts
    │   └── ui.ts
    │
    ├── api/                           ← API client
    │   ├── client.ts                  ← fetch wrapper / interceptors
    │   ├── chat.ts                    ← endpoint groups
    │   └── sse.ts                     ← SSE / streaming
    │
    ├── hooks/                         ← shared hooks (useDebouncedValue, etc.)
    ├── lib/                           ← pure utilities (no React)
    ├── generated/                     ← codegen output (do not hand-edit)
    │   └── api-types.ts               ← from OpenAPI
    └── i18n/
        └── config.ts                  ← react-i18next setup
```

---

## How to read the design system (for any agent landing here)

If you need to understand the visual language **without** hunting through every component:

1. **`src/design-system/tokens/tokens.css`** — every color, spacing, radius, font, shadow lives here as a CSS variable. Read this file first.
2. **`src/design-system/atoms/`** — each atom has a 1-paragraph header comment explaining its purpose, variants, and which tokens it consumes.
3. **`src/design-system/index.ts`** — barrel of what's available.
4. **`src/components/panels/chat/`** — the reference module. If you're building a new module, mimic its structure.

For richer design intent (rationale, "why this color, why this density"), read **`../docs/project/design-system-implementation-plan.md`** and **`../docs/design-references/`**.

---

## Conventions

- **Language**: TypeScript strict mode.
- **CSS**: tokens are global CSS variables (`--ds-*`); component styles are CSS Modules (`.module.css`). No inline styles for production code.
- **Naming**:
  - Components: `PascalCase.tsx`
  - CSS classes inside modules: `kebab-case` (Modules scope them automatically — no need for BEM)
  - CSS variables: `--ds-<category>-<role>` (e.g. `--ds-bg-1`, `--ds-text-primary`, `--ds-radius-md`)
- **State**: Zustand for cross-component state. Local React state for component-internal.
- **Data fetching**: TanStack Query. Stores hold UI state, Query holds server state — don't mix.
- **Routing**: React Router v6.
- **i18n**: react-i18next. All user-facing strings go through `t()`. Never hardcode in components.
- **Testing**: Vitest for units (`*.test.ts(x)`), Playwright for e2e (`tests/e2e/*.spec.ts`).
- **Imports**: use `@/` alias for `src/` (configured in `tsconfig.json` + `vite.config.ts`).

---

## How design changes flow in

```
design agent (in frontend-handoff/)
    │
    │  produces:
    │  - prototype.html   (visual + interaction reference)
    │  - components.md    (component tree + props)
    │  - states.md        (state machine)
    │  - tokens-proposal.md (if new tokens needed)
    │
    ▼
Claude Code (here, in frontend/)
    │
    │  translates:
    │  - prototype HTML/JSX → real .tsx + .module.css
    │  - mock state → zustand store + TanStack Query
    │  - hardcoded strings → i18n keys
    │  - adds tests
    │
    ▼
real shipped code
```

When picking up a handoff, start from `../frontend-handoff/CLAUDE.md` — it explains the protocol.

---

## Status

- **chat module**: working prototype exists in design space; production implementation pending. Existing scaffolding under `src/components/panels/chat/` is from earlier work.
- **design-system**: tokens and atoms scaffolded; populating in progress (see `../docs/project/design-system-implementation-plan.md`).
- **other modules**: not started.

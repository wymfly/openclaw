# frontend-handoff/ — Design ↔ Engineering Bridge

> **The handoff zone between the design agent (Claude in this Anthropic project) and Claude Code (in the deck-go repo).**
>
> If you are **Claude Code**, read this file first. It tells you how to translate what the design agent produced into real code under `../frontend/`.
>
> If you are the **design agent**, this directory is your delivery surface. Everything you produce for engineering goes here.

---

## What lives here

```
frontend-handoff/
├── CLAUDE.md                   ← this file (protocol)
├── design-system/              ← DS source-of-design (proposals + previews)
│   ├── README.md
│   ├── tokens.css              ← canonical tokens (mirrors frontend/src/design-system/tokens/tokens.css)
│   ├── preview.html            ← single-page review canvas: shows every token + atom
│   ├── atoms/                  ← atom prototypes (.html or .jsx) — design intent
│   │   └── <atom>/
│   │       ├── prototype.html
│   │       └── notes.md
│   └── proposals/              ← pending changes awaiting Claude Code review
│       └── 2026-MM-DD-<change>.md
│
├── modules/                    ← FINISHED handoff packages (one per module)
│   └── <module-name>/
│       ├── README.md           ← entry point: what this module does, status
│       ├── prototype.html      ← high-fidelity working prototype (single file)
│       ├── components.md       ← component tree + props contracts
│       ├── states.md           ← state machine + edge cases
│       ├── interactions.md     ← keyboard / hover / focus / empty / error / loading
│       ├── api-usage.md        ← which endpoints this module calls + payloads
│       └── tokens-proposal.md  ← (optional) new tokens needed for this module
│
└── explorations/               ← UNFINISHED design exploration (Claude Code: ignore)
    └── YYYY-MM-<topic>/
```

**The line is:** anything in `modules/` is **ready to implement**. Anything in `explorations/` is **not** — design agent is still iterating, do not start work on these.

---

## Roles

| Role | What they do here |
|---|---|
| **Design agent** (Claude in this Anthropic project) | Maintains everything in this directory. Produces prototypes, writes handoff docs, proposes token/atom changes. Does **not** edit `../frontend/`. |
| **Claude Code** (in deck-go repo) | Reads this directory. Implements modules into `../frontend/src/`. May reject / amend proposals — final authority over `../frontend/`. After implementing, optionally writes a one-liner status update back into the module's `README.md`. |
| **Human (you)** | Arbiter. Approves tokens, picks between design variants, settles disagreements between agents. |

---

## The handoff protocol (per module)

### 1. Design agent finishes a module

When a module is ready for implementation, the design agent creates `modules/<name>/` with **all six files** above. The module's `README.md` is the entry point:

```markdown
# <Module Name>

**Status**: ready-for-implementation
**Design completed**: YYYY-MM-DD
**Designer**: design agent
**Depends on atoms**: Button, Input, Tag, ...
**New atoms needed**: (none | <list>)
**New tokens needed**: (none | see tokens-proposal.md)
**Backend endpoints used**: (none | see api-usage.md)

## What this module does
<1-2 paragraphs of plain-English purpose>

## How to implement
1. Read prototype.html (run it locally to feel the interactions)
2. Read components.md for the component tree
3. Read states.md for state shape and transitions
4. Read interactions.md for keyboard / a11y / edge cases
5. Read api-usage.md for endpoint contracts
6. (If tokens-proposal.md exists) review and merge tokens first

## Open questions for Claude Code
- ...
```

### 2. Claude Code picks it up

Claude Code reads the README, then in order:
1. **Open `prototype.html` in a browser** — feel the interactions, hover states, animations. The HTML is the source of visual truth.
2. **Read `components.md`** — gives you the component tree and prop interfaces. Translate the JSX-like pseudocode into real `.tsx` files at `../frontend/src/components/panels/<module>/`.
3. **Read `states.md`** — translate the state machine into a Zustand store at `../frontend/src/stores/<module>.ts` and a TanStack Query setup if there's server state.
4. **Read `interactions.md`** — implement keyboard handlers, focus management, empty/error/loading states.
5. **Read `api-usage.md`** — wire up `../frontend/src/api/<module>.ts` against the real endpoints. If contracts mismatch reality, raise it (don't silently bend the prototype).
6. **(If present) Apply `tokens-proposal.md`** — merge new tokens into `../frontend/src/design-system/tokens/tokens.css` first, before building components.
7. **Add tests** under `../frontend/tests/`.
8. **Update the module's `README.md`** with a Status line: `Status: implemented (commit <sha>)`.

### 3. If Claude Code disagrees with the design

Claude Code is the final authority on what ships. If a design choice is impractical (perf, a11y, framework constraints, security), Claude Code:
- Implements a working version with notes in `modules/<name>/implementation-notes.md`
- Flags the divergence to the human
- Optionally requests a redesign — design agent updates the module package

Don't silently rewrite the prototype's behavior. Either match it or document why you didn't.

### 4. If the design agent needs to revise

After Claude Code implements, if the design agent needs to revise (visual tweak, new variant, new state):
- New revision goes back into `modules/<name>/` with a version bump in README (`Status: revised vN — pending implementation`)
- Old `prototype.html` becomes `prototype-v1.html` for history
- Claude Code re-syncs from the revised package

---

## Translation rules (HTML/JSX → TS/CSS Modules)

The design agent writes prototypes in single-file HTML with inline JSX (Babel standalone). Claude Code converts this to the real stack. Standard mappings:

| Prototype | Real frontend |
|---|---|
| `<script type="text/babel">` inline JSX | `.tsx` files under appropriate folder |
| Inline `<style>` with `--ds-*` variables | `.module.css` next to the component (variables stay global) |
| Hardcoded English/Chinese strings | `t('module.key')` + entries in `messages/{en,zh}.json` |
| `useState` for everything | Local `useState` for UI-only; Zustand for shared; TanStack Query for server data |
| `fetch('/api/...')` mock | `src/api/<module>.ts` real client + Query hooks |
| Inline SVG icons | Move to `src/design-system/icons/` if reused; keep inline if one-off |
| `localStorage` direct access | Wrap in a typed `lib/storage.ts` helper |
| Component name collisions | Don't worry — design agent's prototype runs in one file; you're splitting into modules where this isn't an issue |

What stays the same (must not be lost in translation):
- **Class names** — keep the same kebab-case names, even when moving to CSS Modules. Makes it easy to map prototype → production.
- **Token references** — every `var(--ds-*)` in the prototype must exist in `../frontend/src/design-system/tokens/tokens.css`. If not, raise a tokens-proposal first.
- **Interaction details** — animation timing, easing, hover delays, keyboard shortcuts. These are *design decisions*, not implementation details.
- **Visual hierarchy** — never substitute a different visual treatment for the prototype's. If the prototype shows a 12px icon next to 14px text, ship 12/14, not 16/16.

---

## Design system flow (special case)

The design system is the **shared layer** between design and engineering, so it has a slightly different flow:

| Source | Mirrored to |
|---|---|
| `frontend-handoff/design-system/tokens.css` | `../frontend/src/design-system/tokens/tokens.css` |
| `frontend-handoff/design-system/atoms/<atom>/prototype.html` | `../frontend/src/design-system/atoms/<Atom>/<Atom>.tsx` + `.module.css` |

**Tokens are co-edited.** When the design agent proposes a token change:
1. Updates `frontend-handoff/design-system/tokens.css` AND drops a memo in `proposals/`
2. Claude Code reviews, applies (or pushes back) to `../frontend/src/design-system/tokens/tokens.css`
3. The two files must match after every cycle. If they drift, the human arbitrates.

**Atoms** start as design-agent prototypes; Claude Code productionizes them. Once productionized, the design agent's prototype becomes a *reference* — Claude Code's `.tsx` is canonical. If the design agent wants to change an atom, it does so by:
1. Forking the atom's prototype in `frontend-handoff/design-system/atoms/<atom>/v2.html`
2. Filing a proposal in `frontend-handoff/design-system/proposals/`
3. Waiting for Claude Code to update `../frontend/src/design-system/atoms/<Atom>/`

`frontend-handoff/design-system/preview.html` is a single-page review canvas showing every token swatch and every atom variant. Open this to see the whole DS at a glance.

---

## How an agent should orient on landing here

**Claude Code, you just opened this directory. Do this:**

1. Read this `CLAUDE.md` (you're doing it).
2. Glance `modules/` — is there anything in here? That's your queue.
3. Glance `design-system/proposals/` — pending token / atom changes to merge.
4. If a module's README says `Status: ready-for-implementation`, that's your next ticket.
5. Don't read `explorations/` unless explicitly told — it's the design agent's scratchpad.

**Design agent, you came back to this directory. Do this:**

1. Read this `CLAUDE.md`.
2. Read `../docs/CLAUDE.md` for project-wide context.
3. Glance `modules/` — what's already shipped? What's the architectural style?
4. If picking up new design work, decide: is it a new module (`modules/<new>/`) or a DS change (`design-system/proposals/`)?
5. If exploring (variants, brainstorms), use `explorations/YYYY-MM-<topic>/` — Claude Code will not look there.

---

## Reference: Vite + React + TS specifics (so design agent prototypes mimic real stack)

The design agent doesn't run `vite` — it ships single-file HTML prototypes. But the prototypes should *resemble* the target stack so translation is mechanical:

- **CSS variables**: `var(--ds-bg-1)` — same name as production
- **Class names**: kebab-case, scoped under module name (e.g. `chat-shell__sidebar`)
- **Component shape**: function components with TypeScript-style prop comments above (`/** @param {string} variant */`)
- **State**: `useState` / `useReducer` — Claude Code lifts to Zustand
- **Side effects**: `useEffect` with cleanup — Claude Code keeps as-is or moves to Query
- **Async data**: mock with `setTimeout` + Promise — Claude Code replaces with TanStack Query

The closer the prototype's structure to the real component, the less translation work.

---

## Status

- **First handoff package**: chat module (forthcoming, see `modules/chat/`)
- **DS preview canvas**: forthcoming, see `design-system/preview.html`
- **Tokens canonical file**: forthcoming, see `design-system/tokens.css`

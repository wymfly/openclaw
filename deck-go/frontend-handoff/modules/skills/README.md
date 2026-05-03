# Skills (Catalog + Hub)

**Status**: revised v2 — pending implementation
**Design completed**: 2026-05-04
**Designer**: design agent (Claude)
**Depends on atoms**: Pill, Badge, Tag, Button, IconButton, Modal, Tabs, KbdHint, Avatar,
EmptyState, Input, RadioCard
**Depends on canonical patterns**: PageShell, SectionHeader, EmptyState
**Depends on canonical icons**: IconSearch, IconChevronRight/Left, IconCheck, IconX, IconAlert,
IconInfo, IconRefresh, IconDownload, IconUpload, IconExternal, IconBox, IconCloud, IconPuzzle,
IconZap, IconTerminal, IconKey, IconClock, IconBookOpen, IconFile, IconCopy, IconTrash,
IconSettings, IconKbd, IconHash
**New atoms needed**: none — local prototype molecules (`source-pill`, `hub-row`, `install-option`,
`install-progress`, `checklist`, `trigger-chip`, `install-option-card`, `files-table`,
`config-list`) all map to existing atoms in production
**New tokens needed**: none — uses canonical `--ds-*` from
`frontend-handoff/design-system/tokens.css`
**Backend endpoints used**: see `api-usage.md` (Deck skills inventory + hub search/detail/install)

## What this module does

Skill catalog workbench — both the installed inventory AND the hub-searchable marketplace. Skills
are reusable workflows surfaced via SKILL.md trigger keywords. Unlike plugins (which is read-only
inventory), the skills contract supports mutation: install from hub, configure key/value, enable /
disable.

The panel handles four primary jobs:

1. **Browse installed inventory** — filter / search by name, source, status.
2. **Search the hub** — discover new skills, preview manifest, install with one wizard.
3. **Configure a skill** — edit per-skill key/value config (writes via the update endpoint).
4. **Enable / disable** — flip enablement, with a confirm step for managed skills (because hub
   bins get pulled from PATH).

## How to implement

1. Open `prototype.html` in a browser:
   - Default mode is **Installed**. 12 skills covering all 3 sources (bundled / managed / plugin)
     and all 3 statuses (ready / needs-setup / disabled).
   - Click the **Hub** segment to switch to the marketplace search list with 8 mock skills.
   - Click any installed row → Detail (6 tabs: Overview / Setup / Triggers / Bins / Files / Audit).
   - Hub rows have a Preview + Install action; Install opens a 3-phase wizard (idle → running →
     done | error).
   - Detail hero has Configure / Disable / Files actions.
   - The Tweaks panel exercises every state, every dialog, and every tab.
2. Read `components.md` — production component skeleton + props shapes.
3. Read `states.md` — view routing + per-tab state + dialog state machine.
4. Read `interactions.md` — keyboard / pointer / hover / dialog flows.
5. Read `api-usage.md` — endpoint truth, DTO shapes, BFF projections, open assumptions.
6. Translate each `.jsx` file to TypeScript at the production target listed in `components.md`.
   Replace `__fixtures__` mock with real fetch hooks. Keep kebab-case classes verbatim.

## Open questions for Claude Code

- **Hub install side-effects.** The wizard assumes a synchronous BFF endpoint. If the hub install
  is asynchronous (e.g., download → unpack → register on next session start) the "Open in
  inventory" CTA needs to be a status check instead of a navigate.
- **Bin removal on disable.** Is "Disable" a soft toggle, or does it remove managed bins from
  PATH? Prototype copy assumes the latter for managed skills, the former for bundled / plugin.
  Confirm with backend.
- **Trigger projection authority.** Prototype renders BFF-extracted trigger keywords. If the
  backend prefers to keep SKILL.md as the source of truth and only surface a slug-keyed list,
  drop the chip render and link to a "View SKILL.md" affordance instead.
- **Config schema.** Prototype shows free-form key/value editor. If skill configs have JSON
  schemas (some hub skills carry one), the Configure dialog should switch to schema-driven form
  rendering for those.

## File inventory (v2)

```
skills/
├── README.md                    ← this file
├── prototype.html               ← ~30-line shell loading external .jsx via Babel standalone
├── prototype-v1-codex.html      ← preserved V1 single-file prototype (reference)
├── app.jsx                      ← App shell + list↔detail routing + 4 dialogs + ⌘K/⌘N/⌘R/Esc
├── list-view.jsx                ← Two modes (Installed | Hub) + KPI strip + 8-col rows + hub rows
├── detail-view.jsx              ← Hero + 6 tabs (Overview/Setup/Triggers/Bins/Files/Audit)
├── dialogs.jsx                  ← Install wizard + Configure + Disable confirm + Files preview
├── data.js                      ← contract-shaped MOCK with 12 installed + 8 hub + projections
├── icons.jsx                    ← 25 SVG icons + SkillGlyph (emoji + source-aware tint)
├── styles.css                   ← Linear-inspired, --ds-* tokens only, dark/light + density-aware
├── tokens.css                   ← mirror copy of canonical tokens
├── tweaks-panel.jsx             ← shared design-time tooling
├── components.md                ← production component skeleton + props shapes
├── states.md                    ← state machine + focus + a11y
├── interactions.md              ← keyboard / pointer / hover / dialog flows
└── api-usage.md                 ← endpoint truth + DTO shapes + BFF projections + assumptions
```

## Reverse sign-off

(pending Claude Code implementation in `frontend-new/src/components/panels/skills/`)

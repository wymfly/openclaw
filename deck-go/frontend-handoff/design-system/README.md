# design-system/ — Design source layer

> Mirror of `../../frontend/src/design-system/`, but from the design side.
> The **canonical** files are in `frontend/`; this directory is for **proposing** changes and **previewing** the system.

## Files

- **`tokens.css`** — proposed / current tokens. Should match `../../frontend/src/design-system/tokens/tokens.css` after every sync cycle. Edit here when proposing a change.
- **`preview.html`** — single-page review canvas. Shows every color swatch, type ramp, spacing/radius scale, every atom and its variants. Open in browser to see the whole system. Built and maintained by the design agent.
- **`atoms/<atom>/`** — design intent for each atom. `prototype.html` is the visual + interaction reference; `notes.md` describes purpose, variants, props, when to use vs not use.
- **`proposals/`** — pending changes awaiting Claude Code review. One file per proposal, named `YYYY-MM-DD-<short-name>.md`.

## Workflow

**Adding a token / changing a token**

1. Edit `tokens.css` here
2. Drop a proposal at `proposals/YYYY-MM-DD-<name>.md` describing what / why / impact
3. Claude Code reviews → applies (or pushes back) to `../../frontend/src/design-system/tokens/tokens.css`
4. After merge, this file and the production file should match again

**Adding an atom**

1. Build prototype at `atoms/<NewAtom>/prototype.html`
2. Write `atoms/<NewAtom>/notes.md` (purpose, variants, props)
3. Drop a proposal at `proposals/YYYY-MM-DD-add-<atom>.md`
4. Claude Code productionizes to `../../frontend/src/design-system/atoms/<NewAtom>/`

**Changing an existing atom**

1. Fork prototype to `atoms/<Atom>/v2.html` (keep v1 for diff)
2. Update `notes.md` with what's changing
3. Drop a proposal at `proposals/YYYY-MM-DD-update-<atom>.md`
4. Claude Code applies

## Discovery

If you (any agent) need to know "what tokens / atoms exist right now in production," the answer is **`../../frontend/src/design-system/`** — not this directory. This directory shows _intent_; that one shows _reality_.

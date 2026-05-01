# proposals/ — Pending DS changes awaiting Claude Code review

> One file per proposal. Each describes a token / atom / molecule change the design agent wants to land.
> Claude Code reviews → applies (or pushes back) → marks resolved.

## File naming

```
YYYY-MM-DD-<short-kebab-name>.md
```

Examples:

- `2026-05-01-add-dark-tokens.md`
- `2026-05-03-button-sm-padding.md`
- `2026-05-10-add-toolbar-molecule.md`

## Proposal template

```markdown
# <Title>

**Date**: YYYY-MM-DD
**Author**: design agent
**Type**: token-add | token-change | atom-add | atom-change | molecule-add | …
**Status**: pending | accepted | rejected | applied

## What's changing

<plain English summary>

## Why

<rationale: visual problem solved, consistency gap, new module need>

## Files touched in this directory

- `tokens.css` (sections X, Y)
- `atoms/Button/prototype.html` (new)

## Files Claude Code should touch

- `frontend/src/design-system/tokens/tokens.css`
- `frontend/src/design-system/atoms/Button/Button.tsx`
- `frontend/src/design-system/atoms/Button/Button.module.css`

## Impact

- Breaking: yes/no
- Affects modules: chat, deck-list, …
- Estimated implementation effort: small / medium / large

## Open questions for Claude Code

- ...

## Resolution (filled in by Claude Code after review)

- Decision: applied / partial / rejected
- Commit: <sha>
- Notes: <if anything diverged>
```

## Lifecycle

1. Design agent drops proposal here as `pending`
2. Claude Code reads, replies in the `Resolution` section, updates Status
3. Once `applied`, the proposal stays for history (don't delete — useful for audits)
4. If rejected, design agent updates / closes

## Current proposals

(none yet)

# explorations/ — Design agent's scratchpad

> **Claude Code: do not read this directory.** Nothing here is ready to implement.
> **Human: feel free to peek** if you want to see the design agent's thinking-in-progress.

## What lives here

Unfinished design exploration:

- Variant comparisons (3-5 versions of the same screen)
- Visual / interaction experiments
- Brainstorming sketches
- Mid-design pivots that haven't landed yet

## Naming

```
explorations/YYYY-MM-<topic>/
```

Examples:

- `2026-05-deck-list-layout/` — exploring 4 layouts for the deck list view
- `2026-05-empty-state-tone/` — testing empty-state copy variations

## When something graduates

When an exploration converges and is ready for engineering:

1. Pick the winning variant
2. Build the full handoff package at `../modules/<name>/` (all six required files)
3. Either delete the exploration directory or leave it for history (your choice)

## Why this is separate from `modules/`

If everything mixed together, Claude Code couldn't tell what's ready vs what's a half-formed sketch. That ambiguity wastes its time. The two-directory split is the cheapest signal.

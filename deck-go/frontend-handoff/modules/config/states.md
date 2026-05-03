# config — states (v2)

## Top-level state

```ts
{
  // Top-level navigation
  activeSection: "agents" | "models" | "channels" | "plugins" | "hooks" | "runtime",
  navQuery: string,                       // section-nav search filter

  // Draft + snapshot
  snapshot: DeckGoConfigSnapshotResponse, // last successful GET /api/config
  draft: Record<string, unknown>,         // current edited config (mirror of snapshot.config + edits)
  draftRaw: string,                       // serialized JSON for the raw editor
  draftValid: boolean,                    // last JSON.parse() succeeded

  // Right pane
  paneMode: "diff" | "raw" | "history",

  // Mutation lifecycle
  dialog: { kind: "apply" | "reset" | "snapshot" } | null,

  // History
  recentApplies: ApplyEvent[],            // last 8 apply attempts (BFF projection)
  now: number,                            // for relative-time formatting
}
```

Tweaks-driven (design-time only):

```ts
{
  theme: "dark" | "light",
  density: "compact" | "cozy",
  paneMode: "diff" | "raw" | "history",   // mirrors the user paneMode for demo
}
```

## Hash semantics

The contract uses **optimistic concurrency** via two hashes:

- `snapshot.hash` — the hash of the document the user fetched.
- `snapshot.baseHash` — same value at fetch time (server reuses for the next apply).
- On apply, the client sends `baseHash`; the server rejects with 409 if
  someone else applied changes between fetch and apply.

The prototype synthesizes a `draftHash` whenever the draft diverges from the
snapshot — `draft-<12-char hex>` — so the user can see the chip change as
they edit. Production may keep a constant draft hash (only the server-issued
hash matters for the apply call).

## List-section dirty composition

`dirtyPaths` is computed by deep-diffing `draft` vs `snapshot.config`. The
result drives:

1. **Section nav badge**: count of paths whose `top` segment matches the
   section id.
2. **Subsection badge**: count of paths under the subsection's path.
3. **Per-field `field-row--dirty`**: exact path match.
4. **Footer apply button**: total count + enable/disable.

## Diff classification

`computeDiff(base, draft)` flattens both objects to dotted-path leaves
(arrays kept whole) and compares per-key:

- `before === undefined` → `added`
- `after === undefined` → `removed`
- otherwise (deep-unequal) → `modified`

Equal keys are skipped — the empty-state card renders when `diff.length === 0`.

## Per-pane states

| Pane    | mode      | Renders                                                                          | Empty fallback                      |
| ------- | --------- | -------------------------------------------------------------------------------- | ----------------------------------- |
| Diff    | `diff`    | `DiffList` of `added/removed/modified`                                           | check glyph + "Draft matches base." |
| Raw     | `raw`     | `<textarea>` with full draftRaw + valid pill                                     | n/a (always renders the textarea)   |
| History | `history` | `ApplyHistory` rows (relative + absolute time + hashes + actor + optional error) | n/a (mock seeds 4 entries)          |

## Form-row dynamics

The form is **schema-driven**. For each child returned by
`schemaLookups[currentSectionPath]`:

- `hasChildren: true` → render `SubsectionCard` (collapsible)
- `hasChildren: false` → render `FieldRow` with control matched to type/hint

Editing a leaf calls `onChange(path, nextValue)` which:

1. Deep-clones the draft + writes the value at the dotted path
2. Re-serializes to `draftRaw`
3. Recomputes `dirtyPaths` (memoized off `draft + snapshot`)

Editing the raw textarea reverses the flow: `JSON.parse(text)` → if it parses,
`setDraft(parsed)` and `setDraftValid(true)`; if not, just `setDraftValid(false)`
and leave the form pane at the last-valid draft.

## Dialog flows

### ApplyConfirmDialog

```
opened ─[Cancel]─▶ closed
       ─[Apply]──▶ running ─(720ms)─▶ done ─(480ms)─▶ closed (parent updates snapshot)
                                   └─▶ error (12% simulated 409) ─[Retry]─▶ running
                                                               └─[Dismiss]─▶ closed
```

In production the wizard performs:

1. POST `/api/config/apply` with `{ baseHash, raw }`
2. On 200, capture `apply.hash` + `apply.baseHash` and update local snapshot.
3. On 409 (hash mismatch), enter `error` phase + suggest "Refresh & retry".

### ResetDialog

```
opened ─[Cancel]─▶ closed
       ─[Reset N changes]─▶ closed (parent restores draft to snapshot.config)
```

No async — a pure local state revert.

### RawSnapshotDialog

Stateless. Renders `JSON.stringify(snapshot, null, 2)` + Copy button.

## Error states (production target)

| Error                              | UI                                                          |
| ---------------------------------- | ----------------------------------------------------------- |
| GET /api/config 5xx                | full-width error overlay with retry CTA                     |
| schema-lookup 5xx (per subsection) | inline empty card "No schema lookup loaded for `<path>`."   |
| apply 409 (hash mismatch)          | dialog stays open in `phase--error`; banner hints refresh   |
| apply 422 (validation)             | dialog stays open; field-level errors echoed in subsections |
| Raw editor JSON parse error        | sticky `JSON invalid` pill; form pane uses last-valid draft |

## A11y / focus rules

- After a SectionNav item is clicked → focus jumps to the form section
  heading (so the user can `Tab` directly into the first field).
- After a SubsectionCard is expanded → focus stays on the toggle button
  (Enter to expand, Tab to descend).
- After ApplyConfirmDialog `done` → focus returns to the apply button in
  form section footer.
- After Reset → focus moves to the section nav search input.
- ⌘K → focus the section nav search input from anywhere.

## Boundary cases

- **Empty snapshot** (`exists: false`): production should render an
  EmptyState with a CTA to create `~/.openclaw/openclaw.json`. The prototype
  always seeds with `exists: true`.
- **Invalid snapshot** (`valid: false`): the form pane is hidden and the
  raw pane forces `mode: "raw"` so the user can repair the file.
- **Unknown section** (URL targets a section that has no schemaLookup):
  shows `form-section__empty` card with "Click Refresh to fetch from BFF."
- **Schema cache miss on subsection expand**: subsection body shows
  `subsection__empty` until the lookup resolves; `Refresh` triggers a
  re-fetch.

## Stale threshold

Apply history surface uses **relative time** for the head row (`12m ago`,
`3h ago`, `1d ago`) and **absolute timestamp** for the meta row. There is
no "stale" classification on apply events — they're either `ok` or `err`.

## Theme variants

- `data-theme="dark"` (default) — uses canonical `--ds-*` palette.
- `data-theme="light"` (Tweaks demo only) — overrides body colors via the
  `[data-theme="light"]` block in `styles.css`. Production light theme will
  flip the entire token set, not just body — this prototype tweak is a
  visual sanity check, not a full light theme.

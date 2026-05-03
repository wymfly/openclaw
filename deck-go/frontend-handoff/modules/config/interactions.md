# config — interactions (v2)

## Pointer

- **SectionNav item click** → switches `activeSection`, scrolls form pane to
  top. Form section title + path update synchronously. Cursor `pointer`.
- **Subsection toggle click** → expands/collapses `SubsectionCard`.
  Default-open at depth 0; default-closed at depth ≥ 1.
- **Field control change** (input / select / toggle / textarea) → live
  updates draft; dirty count reflects in real time across nav badge,
  subsection badge, field row tint, and topbar pill.
- **Diff row path click** → switches `activeSection` to the row's top
  segment so the user can jump to the source of the change.
- **Diff pane mode tab click** → swaps between Diff / Raw / History.
- **Form section "Show diff" / "Hide diff" button** → toggles paneMode
  between `diff` ↔ `raw`. Convenience for the most common toggle without
  going to the right tab strip.
- **Footer "Reset draft"** → opens `ResetDialog`. Disabled when
  `dirtyPaths.length === 0`.
- **Footer "Preview & apply"** → opens `ApplyConfirmDialog`. Disabled when
  no edits.
- **DiffPane footer "View snapshot"** → opens `RawSnapshotDialog`.
- **Modal backdrop click** → closes the dialog (except in `running` phase).

## Keyboard

| Key                 | Context                | Behavior                                   |
| ------------------- | ---------------------- | ------------------------------------------ |
| `⌘K` / `Ctrl K`     | anywhere               | Focus the section-nav search input.        |
| `Enter` / `Space`   | focused SubsectionCard | Toggle open/closed.                        |
| `Esc`               | open dialog            | Close dialog (except `running` phase).     |
| `Tab` / `Shift Tab` | inside form section    | Cycle through field controls in DOM order. |
| `Tab` / `Shift Tab` | inside DiffPane head   | Cycle Diff → Raw → History → footer.       |

The Apply dialog's wizard is **non-cancellable in the `running` phase**:
both Esc and backdrop click are no-ops while the prototype's 720ms timer
is in flight. Production must mirror this — server has likely already
mutated state by the time we'd want to "cancel".

## Hover

- **SectionNav item** — bg lifts to `--ds-bg-hover`. Active item keeps
  accent inset shadow + brighter text.
- **Subsection toggle** — bg lifts to `--ds-bg-hover`.
- **Field control focus-within** — border accent + 2px accent-bg ring.
- **Diff row path button** — `code` foreground brightens to accent.
- **Diff pane mode tab** — text brightens; selected stays bg-0 with
  accent inset border.
- **Buttons (`ds-btn`)** — bg-2 → bg-hover; primary keeps accent fill on
  hover (inverts to filled accent on hover with bg-0 text).

## Density

`compact` (default):

- Field row padding `10px 12px`.
- Subsection toggle padding `10px 12px`.
- Section nav item padding `9px 10px`.
- Inputs `6px 9px`.

`cozy`:

- Field row padding `14px 14px`.
- Subsection toggle padding `14px 14px`.
- Section nav item padding `12px 12px`.
- Inputs `8px 11px`.

The Tweaks panel toggles between the two via `data-density` on the root.

## Empty / loading / error

| Scenario                     | UI                                                                      |
| ---------------------------- | ----------------------------------------------------------------------- |
| `dirtyPaths.length === 0`    | Diff pane shows check glyph + "Draft matches base. Nothing to apply."   |
| Schema lookup miss           | Subsection body: "No schema lookup loaded for `<path>`. Click Refresh…" |
| Section search zero results  | Section nav: "No sections match." inline empty row                      |
| Apply dialog phase = running | Dialog footer hidden; phase pill "Applying…" shown                      |
| Apply dialog phase = done    | green check + "Applied. Closing…"                                       |
| Apply dialog phase = error   | red banner + Retry/Dismiss footer; backdrop dismissable                 |
| Raw editor JSON invalid      | Status pill "JSON invalid" (warn tone); form pane uses last-valid draft |
| ApplyHistory error row       | error tinted border + inline error message line                         |

## Focus

- After SectionNav item click → focus jumps to form section title (so
  Tab descends into fields immediately).
- After dialog dismiss → focus returns to the trigger button.
- After ResetDialog confirm → focus returns to section nav search.
- After ApplyConfirmDialog `done` → focus returns to the apply button.
- After expanding a subsection via keyboard → focus stays on toggle.
- Focus-visible outline on form rows uses accent ring (browser default).

## A11y semantics

- SectionNav: `<aside>` with `aria-label`. Items use `role="tab"` +
  `aria-selected` (the SectionNav itself acts as the tablist).
- Subsection toggle: `<button>` + `aria-expanded`.
- DiffPane modes: `role="tablist"` + `role="tab"` + `aria-selected`.
- Modal: `role="dialog" aria-modal="true"` + close button has `aria-label="Close"`.
- Field rows: each input has a matching `<label htmlFor>` + `aria-describedby`
  pointing at the inline hint paragraph. Validation errors use
  `aria-live="polite"`.
- Status pills: text content names the state (no color-only signal).
- Required marker uses an explicit "required" word in the badge so screen
  readers announce it; not a glyph-only marker.

## Tweaks-driven exploration

Design-time only. Tweaks panel exposes:

- `theme` ∈ `dark | light`
- `density` ∈ `compact | cozy`
- `paneMode` ∈ `diff | raw | history`
- `dirtyState` ∈ `clean | dirty` (toggles a small mock edit so reviewers
  can see dirty styling without typing)

Production translation drops the panel entirely; equivalent state arrives
from real fetches + user edits.

## Mutation behavior

- **Apply** is destructive but **versioned**: server-side concurrency check
  via `baseHash` means the conflict path is meaningful (someone else applied
  changes since we fetched). Production must surface the conflict and offer
  Refresh & retry rather than silently overwriting.
- **Reset** is destructive and **non-recoverable** in the prototype — there
  is no undo for a discarded draft. Production may keep a transient
  in-memory undo stack for the last reset, but contract has no
  "restore-from-trash" endpoint.
- **Schema lookup** is read-only and idempotent. Cache hot for the lifetime
  of the snapshot; invalidate cache on apply success.

## Cross-pane synchronization

The form and raw editors share a **single draft state**:

- Edit field → mutates draft → re-serializes raw → both stay in sync.
- Edit raw text → tries `JSON.parse` → on success, mutates draft → form
  reflects new values. On parse failure, the form pane is **frozen on the
  last valid draft** until the raw text becomes parseable again.

This single-source-of-truth rule prevents the two views from drifting and
matches the contract truth: the server stores one config, not two.

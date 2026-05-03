# threads — interactions (v2)

## Pointer

- **Thread row click** → enter detail view, set `view=detail`,
  `activeTab=overview`. Cursor `pointer`.
- **Hero "Open chat"** → opens stub modal in prototype; production navigates
  to `Chat` panel scoped to `targetSessionKey`.
- **Hero "Rename label"** → opens `RenameDialog`.
- **Hero "Re-bind agent"** → opens `RebindDialog` (3-phase wizard).
- **Hero "Unbind"** → opens `UnbindDialog` (3-phase wizard, danger styling).
- **Hero "Raw entry"** → opens `RawEntryDialog`.
- **Hero back button** → returns to list.
- **Refresh button (toolbar)** → flips `listState=loading` for 280ms then
  back to `ready`. Production: real fetch.
- **Tab clicks** (Overview / Recent activity / Audit / Raw entry) — switch
  detail body without leaving detail view.
- **Modal backdrop click** → closes the dialog.

## Keyboard

| Key                 | Context                | Behavior                                                  |
| ------------------- | ---------------------- | --------------------------------------------------------- |
| `⌘K` / `Ctrl K`     | anywhere               | Focus the search input                                    |
| `Enter` / `Space`   | focused thread row     | Enter detail view                                         |
| `Esc`               | open dialog            | Close dialog                                              |
| `Esc`               | detail view, no dialog | Return to list view                                       |
| `Tab` / `Shift Tab` | within toolbar         | Cycle focus through search → segmented controls → refresh |

## Hover

- **Thread rows** — bg lifts to `--ds-bg-hover`. Stale rows blend warn-bg
  with hover-bg.
- **Action buttons** — bg `--ds-bg-2` → `--ds-bg-hover`. Primary keeps
  accent-bg; danger keeps error-bg.
- **Segmented buttons** — text color brightens; selected stays
  bg-3 with accent inset shadow.
- **Tab labels** — text color brightens on hover; selected has accent
  bottom-border.
- **Channel tile glyph** — solid bg, no hover state (decorative).

## Density

`compact` (default):

- Row padding `12px 16px`.
- Metric tiles 56px min height.
- Timeline rows `8px 16px`.

`cozy`:

- Row padding `16px 16px`.
- Metric tiles 64px min height.
- Timeline + audit rows `12px 16px`.

The Tweaks panel toggles between the two.

## Empty / loading / error

| Scenario                | UI                                                             |
| ----------------------- | -------------------------------------------------------------- |
| `listState = "loading"` | full-width spinner overlay "Refreshing thread bindings…"       |
| `listState = "error"`   | error overlay with retry CTA                                   |
| filter zero results     | `IconChat` glyph + "No bindings match these filters." + hint   |
| activity tab empty      | "No recent activity projected." card with `IconActivity` glyph |
| audit tab empty         | "No audit entries." card with `IconAudit` glyph                |
| label missing           | hero title falls back to `threadId`                            |
| dialog phase running    | center-aligned phase pill "Unbinding…" / "Updating binding…"   |
| dialog phase done       | green check + "Unbound. Closing…" / "Re-bound to {agent}."     |

## Focus

- After clicking a thread row → focus jumps to detail back button.
- After dismissing a dialog → focus returns to the trigger button.
- After back from detail → focus returns to the search input.
- Focus-visible outline on rows uses accent ring.

## A11y semantics

- Toolbar segmented controls: `role="tablist"` containing `role="tab"`
  buttons with `aria-selected`. The first segment is "all".
- Thread rows: `<li role="button" tabIndex={0}>` — single press target.
- Detail tab bar: `role="tablist"` + `role="tab"` + `aria-selected`.
- Modals: `<div role="dialog" aria-modal="true">` with explicit close
  button carrying `aria-label="Close"`.
- Status pills: text-content names the state (no color-only signal).
- Channel glyphs in tiles: `aria-hidden="true"` (the label text owns the
  announcement).

## Tweaks-driven exploration

Design-time only. Tweaks panel exposes:

- `theme` ∈ `dark | light`
- `density` ∈ `compact | cozy`
- `listState` ∈ `ready | loading | error`
- `detailState` ∈ `ready | empty`

Production translation drops the panel entirely; equivalent state arrives
from fetch + selectors.

## Mutation behavior

- **Unbind** is destructive but reversible (re-bind the same channel later
  re-creates the entry). Local prototype removes the thread from state
  immediately on confirm.
- **Re-bind** updates `agentId` only — `targetSessionKey` stays the same.
  In production this may also reroute the next inbound message to the new
  agent's session.
- **Rename** updates `label` (set or unset). Empty input clears the
  override.

All three mutations are user-triggered; threads has no auto-mutation
surface in v2.

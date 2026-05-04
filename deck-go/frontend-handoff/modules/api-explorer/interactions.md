# Interactions

Keyboard, focus, hover, animations, edge cases. Cross-section coupling — what changes in pane A when pane B mutates.

## Keyboard

| Key                        | Context                 | Effect                                                                                                                                                                 |
| -------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Tab` / `Shift+Tab`        | Anywhere                | Focus rotates: topbar (env / refresh) → tree search → tree namespaces → tree leaves → builder hero actions → builder tabs → form fields → response copy → history rail |
| `Enter` / `Space`          | Tree namespace head     | Toggle expand/collapse                                                                                                                                                 |
| `Enter` / `Space`          | Tree leaf               | Select that method                                                                                                                                                     |
| `↑` / `↓`                  | Tree leaf focused       | (out of scope this iteration) — no arrow nav between leaves                                                                                                            |
| `Cmd+Enter` / `Ctrl+Enter` | Anywhere in the builder | Run the current request (production: implement as keyboard shortcut; prototype: not wired)                                                                             |
| `Esc`                      | Anywhere                | No effect (no modals in this panel)                                                                                                                                    |

Cmd+K is reserved for the global command palette (out of scope this iteration).

## Hover & focus styling

- **Tree leaf** — `background: --ds-bg-2` on hover; selected leaf paints with `--ds-accent-bg-soft` and stays painted on hover
- **Tree namespace head** — color shift `--ds-text-secondary` → `--ds-text-primary` on hover; chevron rotates between right and down
- **Request tab** — color shift on hover; on-state shows accent underline; body tab shows red dot when `bodyError` is set
- **Form fields** — border `--ds-accent-fg` on `:focus`
- **Response status row** — paints linear gradient with subtle ok/err tint based on status code
- **History row** — `background: --ds-bg-3` on hover; left border indicates ok (green) / err (red)
- **Buttons** — primary uses `--ds-accent-bg-hover`; ghost uses `--ds-bg-3`

## Animations

| Element                      | Animation                            | Timing                  |
| ---------------------------- | ------------------------------------ | ----------------------- |
| Run button → Running spinner | rotation `spin` keyframes 360°       | `800ms linear infinite` |
| Tree namespace expand        | (no animation; instant)              | —                       |
| Response pane state change   | (no animation; instant content swap) | —                       |
| Copy → Copied label          | text swap                            | `1400ms` (then revert)  |
| History rail expand/collapse | (no animation; width swap)           | —                       |

## Tree interactions

1. **Click namespace head** → toggle collapsed/expanded; chevron rotates
2. **Click leaf** → `onSelect(method.name)`; URL hash updates; builder swaps to new method
3. **Type in search** → all namespaces auto-expand; non-matching leaves hidden; counts update live ("X / Y")
4. **Clear search** → state restores: previously-collapsed namespaces stay collapsed
5. **Stale selection** → if a previously-selected method is filtered out by search, it stays in URL hash but the tree no longer paints it; the builder still shows it

## Run interaction

1. Click **Run** → button shows spinner + "Running…", disabled
2. After ~480-760ms (sim) → response set, status row updates with tone
3. History prepended with new entry
4. Failed response (sim never produces these for matched methods, but BFF would for unknown methods) → status row paints err, body tab shows ErrorBlock
5. Click **Use sample** → reset draft to method.sample, rawBody re-stringified, bodyError cleared

**Cross-section coupling**: a successful run updates 3 surfaces:

- Response pane (status + body + headers + trace)
- History rail (new entry prepended)
- (production only) `localStorage` persisted history

## Body mode toggle

1. **Form-derived** mode shows `<HighlightedJson>` of the current draft serialized — read-only preview
2. **Raw JSON** mode shows `<textarea>` editable
3. Switching from raw → form: parse current rawBody; if valid, set draft; if invalid, **stay in raw mode** (don't silently lose user's edits) and keep error visible
4. Switching from form → raw: rawBody is replaced with `JSON.stringify(draft, null, 2)`; user's previous raw edits are lost (warn in tooltip on first switch — out of scope this iteration)

## Param form interactions

- Type into a string field → `onChange(value)` immediately; empty string → `null`
- Toggle a boolean → `onChange(boolean)`
- Pick from a select → `onChange(option)`
- Click "Add item" on array → appends `""` to the array; can be edited inline
- Click "Remove" on array row → drops that index
- Edit JSON in object textarea → on each keystroke, attempt `JSON.parse`; on success, update draft; on failure, hold last good draft (no inline error in this iteration — flagged in implementation-notes.md)

## Copy interaction

1. Click **Copy** in response pane → writes the current tab's serialized form to clipboard
   - Body tab → `JSON.stringify(body, null, 2)`
   - Headers tab → `key: value\n…` plain text
   - Trace tab → just the trace id
2. Button label flips to "Copied" for 1400ms, then reverts
3. Clipboard write failures are silent in prototype (production: toast)

## History interactions

1. Click history handle (collapsed) → expands the rail
2. Click an entry → `handleSelectMethod` re-loads the method (params **not** restored — only the method; planned enhancement: restore params via deep entry payload)
3. Click X (close) → collapses the rail
4. New runs prepend to the list, drop oldest beyond 50

## Environment switch

1. Open the env select → 3 options (local / stage / prod)
2. Pick one → `environment` state updates; `env.base` hint updates
3. Side effect: response cleared (avoids showing stale data in a different env's pane)
4. (production) catalog re-described against the new env; until result, builder shows skeleton

## Cross-section coupling

| Action              | Affected sections                                                                                   |
| ------------------- | --------------------------------------------------------------------------------------------------- |
| Select method       | Builder hero, tabs reset to params, draft seeded, response cleared, URL hash updated                |
| Edit a param field  | Body tab "Form-derived" preview updates live; Headers / Docs unchanged                              |
| Edit raw body       | Builder body textarea, body parse error chip on tab, draft (if valid) for next time form mode opens |
| Click Run           | Response pane, history rail, lastDurationMs, button label                                           |
| Click history entry | Method tree selection paints, builder hero swaps                                                    |
| Switch environment  | Response cleared; (production) catalog refetched                                                    |
| Toggle body mode    | Body tab content swaps; nothing else                                                                |

## Cross-module coupling (for production)

- **Gateway panel (US-015)** ↔ **API Explorer**: gateway's batch console is a special case of the explorer's builder for `deck.gateway.batch`. Future enhancement: deep-link from gateway's batch console to "Open in API Explorer"
- **Webhooks panel (US-018)** ↔ **API Explorer**: `deck.webhooks.test` exposed in the explorer; deep-link possible from per-webhook detail to "Test via API Explorer"
- **Audit timeline** (cross-cutting): all `mutation`-kind requests should write to the global audit feed
- **Settings panel (US-020)** ↔ **API Explorer**: scope changes affect which methods are runnable; UI should grey out methods whose `scope` exceeds the current operator's grant

## Edge cases

- **URL hash with unknown method name**: builder shows empty state with "Pick a method on the left"; tree painter shows none selected
- **Catalog returns no methods**: tree shows empty; builder shows empty state
- **Method has no parameters**: ParamsTab shows "No parameters — this method takes an empty payload."
- **Method has streaming kind**: KindBadge paints accent tone, but the response pane has no streaming UI yet (future enhancement)
- **Run fails with 403 + scope error**: response status row paints err, body shows the scope diff (e.g., "scope denied: requires operator.admin")
- **Two runs back-to-back**: button is disabled during running; clicking again does nothing (production: `AbortController` cancellation)
- **Body parse error during running**: button stays disabled until parse succeeds; running state can complete normally because the request was sent before the edit
- **Refresh during running**: prototype loses state; production should keep request in-flight or surface a spinner during reload

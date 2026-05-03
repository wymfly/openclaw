# threads — states (v2)

## View routing

- `view = "list"` → `ThreadsListView`
- `view = "detail"` → `ThreadDetailView`

Selected `threadId` persists across `list↔detail`. A page transition fade
(180ms) animates between the two.

## Top-level state

```ts
{
  view: "list" | "detail",
  query: string,
  channelKindFilter: "__all__" | "discord" | "telegram" | "wecom" | "slack" | "qq",
  targetKindFilter: "__all__" | "claude-code-session" | "agent-loop" | "external-bot",
  staleFilter: "all" | "active" | "stale",
  selectedThreadId: string | null,
  activeTab: "overview" | "activity" | "audit" | "raw",
  dialog: { kind: "unbind" | "rebind" | "rename" | "raw" | "open-chat-stub" } | null,
  threads: DeckGoThreadEntry[]   // local mutable copy of fetched response
}
```

Tweaks-driven (design-time only):

```ts
{
  theme: "dark" | "light",
  density: "compact" | "cozy",
  listState: "ready" | "loading" | "error",
  detailState: "ready" | "empty"
}
```

## List states

| State     | Trigger                         | Renders                                         |
| --------- | ------------------------------- | ----------------------------------------------- |
| `ready`   | threads fetch resolved          | KPI strip + filter bar + binding rows           |
| `loading` | manual refresh in flight        | full-width state overlay with spinner           |
| `error`   | BFF returned 5xx / network fail | error overlay with retry button                 |
| `empty`   | filters narrow to zero rows     | inline empty card with hint copy + CTA fallback |

## Detail states

| State   | Trigger                           | Renders                                     |
| ------- | --------------------------------- | ------------------------------------------- |
| `ready` | thread found + tab body resolved  | hero + tab bar + active tab body            |
| `empty` | nothing selected (in Tweaks demo) | empty state placeholder (rare in real flow) |

Per-tab state:

| Tab        | Source                              | Empty fallback                             |
| ---------- | ----------------------------------- | ------------------------------------------ |
| `overview` | `DeckGoThreadEntry` only            | n/a                                        |
| `activity` | BFF projection (recentActivity[id]) | "No recent activity projected." empty card |
| `audit`    | BFF projection (auditTrail[id])     | "No audit entries." empty card             |
| `raw`      | `DeckGoThreadEntry` JSON            | n/a                                        |

## Filter composition

All filters AND together:

1. **Channel kind** — `channelKindFromId(thread.channelId)` equality (skipped
   for `__all__`).
2. **Target kind** — exact equality on `thread.targetKind` (skipped for
   `__all__`).
3. **Recency** — `now - thread.lastActivityAt`:
   - `active` keeps rows with diff ≤ 24h.
   - `stale` keeps rows with diff > 24h.
   - `all` skips this axis.
4. **Free text** — case-insensitive substring match across
   `threadId | channelId | agentId | targetSessionKey | label | accountId | boundBy`.

The MetricStrip recomputes after filter — visible row count reflects the
applied filter set.

## Stale threshold

`24 * 3600_000` ms (24h). UI choice, not a contract field. The threshold
drives:

- The "Active 24h" KPI tile count.
- The `thread-row--stale` row tint (warn-bg, ~26% alpha).
- The hero "stale 24h+" status pill in detail.
- The Recency segmented filter behavior.

A future pass may make this user-configurable; v2 hardcodes 24h.

## Dialog flows

### UnbindDialog

```
opened ─[Cancel]─▶ closed
       ─[Unbind]─▶ running ─(700ms)─▶ done ─(600ms)─▶ closed (parent removes thread)
```

The "running" and "done" phases are simulated in the prototype. Production
calls the BFF unbind mutation and renders real success / error states.

### RebindDialog

```
opened ─[change agent + Re-bind]─▶ running ─(700ms)─▶ done ─(500ms)─▶ closed (parent updates agentId)
       ─[same agent]─▶ closed (no-op)
       ─[Cancel]─▶ closed
```

Agent picker is a native `<select>` populated from existing threads' agentIds

- a fixed seed list (`main`, `build`, `research`, etc.).

### RenameDialog

```
opened ─[Save]─▶ running ─(500ms)─▶ done ─(400ms)─▶ closed (parent updates label)
       ─[Cancel]─▶ closed
```

Empty label removes the override (sets `label: undefined`).

### RawEntryDialog

Stateless. Renders `JSON.stringify(thread, null, 2)`.

### OpenChatStub

Placeholder. Production replaces with in-app routing to the Chat panel
scoped to `targetSessionKey`.

## Error states (production target)

| Error                       | UI                                                       |
| --------------------------- | -------------------------------------------------------- |
| Threads list 5xx            | full-width error overlay with retry CTA                  |
| Unbind mutation 4xx/5xx     | dialog stays open; phase becomes `error` with red banner |
| Rebind agent does not exist | dialog stays open; inline error under select             |
| Rename label > 120 chars    | client-side input maxLength + red border (production)    |

The prototype only models the happy path for mutations; production must
expose the failure cases.

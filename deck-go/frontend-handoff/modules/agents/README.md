# agents — handoff package

**Status:** `ready-for-implementation`
**Protocol version:** `protocol-v1`
**Design intent:** _forward_ (design → engineering, per protocol-v1)
**Bundle reference:** [`./prototype.html`](./prototype.html)

> This is the second module produced for deck-go (after `chat/`) and the **first forward-flow design**. Sister modules `routing/`, `subagents/`, `activity/` ship in the same wave.

---

## What this module does

`agents/` is the **identity & configuration cockpit** for the deck-go runtime's AI agents. It surfaces:

- **List view (workbench)** — searchable, sortable grid of agents with live status (idle / busy), session load, default-flag, last-active timestamp. Functions as a dashboard, not a passive list.
- **Detail view (configuration workshop)** — left-rail navigation across 7 sections per selected agent:
  1. **Overview** — identity, model, workspace, default toggle, danger zone (delete)
  2. **Skills** — skill mode (`inherit` / `explicit` / `none`) + per-skill enabled toggles + per-skill argument overrides
  3. **Subagents** — which other agents this agent is permitted to delegate to, with policy preview
  4. **Tool policy** — read-only preview of the resolved tool allow/deny list (with provenance: which layer set each rule)
  5. **System prompt** — read-only preview of the resolved system prompt (with section breakdown)
  6. **Files** — workspace file browser scoped to the agent (read/upload)
  7. **Event streams** — per-agent SSE subscription configuration
- **Create wizard** — 5-step guided creation: identity → model → skills → subagents → review
- **Activity badge** — live SSE indicator on each row (`idle` ⚫ / `busy` 🟢 with pulse)

The module is a peer of `chat/`. It does **not** own conversation state; chat consumes agent identity via the shared `agents` store.

---

## Depends on atoms (`@/design-system/atoms/*`)

```
Avatar · Badge · Banner · Button · Card · Chip · Drawer · DropdownMenu ·
EmptyState · IconButton · Input · KeyHint · Markdown · Modal · SegmentedControl ·
SidebarRow · Spinner · Switch · Tab · Textarea · Toast · Tooltip
```

(22 of the 36 canonical atoms.) Adds **no new atoms** — all needs covered by the existing kit. Two **molecules** are introduced and live module-private until promoted:

- `AgentRowCard` — list-row composite (avatar + name + status dot + meta strip + actions)
- `ConfigSectionHeader` — title + helper + optional action button (used 7× in detail view)

If a third module needs either, promote to `frontend-handoff/design-system/atoms/` per `frontend-handoff/CLAUDE.md` §"promotion".

---

## Depends on hooks (`@/design-system/hooks/*` + `@/hooks/*`)

```
@/design-system/hooks: use-click-outside · use-escape-close · use-focus-trap · use-keyboard-nav · use-popover
@/hooks (new):         use-agent-selection · use-create-wizard · use-config-section-router
```

`use-config-section-router` is the local hash-router for the detail view's 7 sections (`#overview`, `#skills`, ...). It coexists with the future top-level `react-router` per `stack-decisions.md`.

---

## Depends on stores (`@/stores/*`)

```
agents (shared, existing) — extended by this module
agents-detail (new, module-private) — { detailMap: Map<id, AgentDetail>, hashes, dirtyEdits }
agents-create (new, module-private) — { wizardStep, draft, validation }
notifications (shared, existing) — for toast on save / delete
```

The `agents-*` cluster is module-private. `agents` (the lean summary store consumed by chat) stays cross-module.

---

## Depends on lib (`@/lib/*`)

```
deck-client (existing, extended) — typed methods for agents.* RPC family
agent-config-merge (new) — pure helpers to compute "effective" tool policy / system prompt previews from layered sources
```

---

## Backend endpoints used

| Endpoint                                                | Direction | Purpose                                            |
| ------------------------------------------------------- | --------- | -------------------------------------------------- |
| `gw.agents.list(query)`                                 | request   | Populate list view (search/sort/filter/paginate)   |
| `GET /agents/{agentId}`                                 | request   | Hydrate detail view                                |
| `POST /agents`                                          | request   | Create (called from wizard "review")               |
| `PATCH /agents/{agentId}`                               | request   | Identity edits (name, emoji, model, workspace)     |
| `DELETE /agents?agentId=...`                            | request   | Delete (with confirm modal)                        |
| `GET /agents/{agentId}/identity`                        | request   | Default-flag toggle reads/writes identity overlay  |
| `GET /agents/{agentId}/files`                           | request   | Files tab listing                                  |
| `POST /agents/{agentId}/files`                          | request   | Files tab upload                                   |
| `GET /agents/{agentId}/files/{name}`                    | request   | Files tab single-file fetch                        |
| `GET /deck/agents?agentId=...&kind=skills`              | request   | Skills tab data                                    |
| `POST /deck/agents` (kind=skills)                       | request   | Skills tab save                                    |
| `GET /deck/agents?agentId=...&kind=subagent`            | request   | Subagents tab data                                 |
| `POST /deck/agents` (kind=subagent)                     | request   | Subagents tab save                                 |
| `GET /deck/agents?agentId=...&kind=tool-policy-preview` | request   | Tool policy preview                                |
| `GET /deck/agents?agentId=...&kind=system-prompt`       | request   | System prompt preview                              |
| `GET /deck/agents?agentId=...&kind=event-streams`       | request   | Event streams tab data                             |
| `POST /deck/agents` (kind=event-streams)                | request   | Event streams tab save                             |
| `GET /api/stream` → `activity.event`                    | SSE       | Live agent status (idle/busy) for list dots & rows |

Detailed payloads + **proposed protocol deltas** in [`./api-usage.md`](./api-usage.md).

---

## Proposed protocol enhancements (per scope option a — "ideal protocol drives design")

These are designed against an **ideal contract**; api-usage.md flags each delta against the current contract. Claude Code is expected to thread these into the contract files in `contracts/source/` before / during implementation, with the protocol team's approval.

1. **`AgentSummary` v2** — typed status / sessionCount / bindingCount / isDefault / lastActiveAtMs (replaces opaque `[k]:unknown` extension)
2. **`gw.agents.list` query parameters** — `search`, `sortBy`, `filter`, `cursor`, `limit`
3. **`AgentConfigHashes`** — composite hash bundle replacing parallel per-surface hashes
4. **`skillMode` literal union** — `"inherit" | "explicit" | "none"`
5. **`activity.event` discriminator** — typed `eventType` field with payload union
6. **`AgentHealthSnapshot` typing** — replace `Record<string,unknown>` with concrete union
7. **Split `POST /deck/agents`** — per-kind endpoints (skills / subagents / event-streams)
8. **Drop `allowedAgents` on `SubagentConfigResponse`** — keep `allAgents[]` + per-row `allowed: boolean`

---

## How to read this package

1. **Browser-open `prototype.html`** — feel the visual + interactions. Toolbar at top toggles between **List** and **Detail**, plus **Create wizard** and **Tweaks**.
2. **Read [`components.md`](./components.md)** — component tree + props
3. **Read [`states.md`](./states.md)** — state machine for list / detail / wizard / save / delete
4. **Read [`interactions.md`](./interactions.md)** — keyboard / hover / focus / a11y / empty / error / loading
5. **Read [`api-usage.md`](./api-usage.md)** — endpoints, payloads, **and the protocol deltas** with rationale
6. **Read [`tokens-proposal.md`](./tokens-proposal.md)** — small set of new semantic tokens this module uses (status dots, danger surface)

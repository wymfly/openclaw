# Cross-module readiness matrix

> **Source:** `design-system-cross-module-readiness` capability (frozen by `frontend-design-system-via-chat`).
> **Owner:** Claude Code (engineering implementer of `frontend-new/`).
> **Status:** v1 — initial population for the agents pilot. Updated whenever a panel migration is proposed, an atom / pattern / icon is added, or a panel migration completes.

---

## Cell legend

| Status    | Meaning                                                                                           |
| --------- | ------------------------------------------------------------------------------------------------- |
| `applies` | Panel will consume the canonical atom / pattern / icon as-is                                      |
| `extend`  | Panel needs an additive variant — must file a follow-up proposal                                  |
| `missing` | Panel needs a new atom / pattern / icon not yet canonical — blocks migration until proposal lands |
| `n/a`     | Atom / pattern / icon not relevant to this panel                                                  |
| `tbd`     | Cell unfilled because the panel migration has not been proposed yet                               |

---

## Patterns × panel matrix

Six canonical patterns (introduced by `deck-go-frontend-foundation-readiness`):

| Panel                                              | PageShell | NavRail | TopBar  | EmptyState                             | KbdHint                            | SectionHeader                  | Notes                                                                                           |
| -------------------------------------------------- | --------- | ------- | ------- | -------------------------------------- | ---------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------- |
| `chat` (pilot, migrated)                           | applies   | applies | applies | applies (transcript empty / SSE error) | applies (composer ⌘↵)              | applies (right-panel sections) | Already runs in `frontend-new/`; pattern adoption deferred to a follow-up rationalization       |
| `agents` (pilot, prototype-stage)                  | applies   | applies | applies | applies (3 tones used)                 | applies (⌘K / ⌘N / ⌘S / 1-7 / j/k) | applies (per detail section)   | Prototype lives at `frontend-handoff/modules/agents/`; engineering implementation is downstream |
| `channels`                                         | tbd       | tbd     | tbd     | tbd                                    | tbd                                | tbd                            | Awaiting prototype                                                                              |
| `models`                                           | tbd       | tbd     | tbd     | tbd                                    | tbd                                | tbd                            | Awaiting prototype                                                                              |
| `plugins`                                          | tbd       | tbd     | tbd     | tbd                                    | tbd                                | tbd                            | Awaiting prototype                                                                              |
| `skills`                                           | tbd       | tbd     | tbd     | tbd                                    | tbd                                | tbd                            | Awaiting prototype                                                                              |
| `subagents`                                        | tbd       | tbd     | tbd     | tbd                                    | tbd                                | tbd                            | Awaiting prototype                                                                              |
| `sessions`                                         | tbd       | tbd     | tbd     | tbd                                    | tbd                                | tbd                            | Awaiting prototype                                                                              |
| `activity` / `alerts` / `logs` / `threads`         | tbd       | tbd     | tbd     | tbd                                    | tbd                                | tbd                            | Activity-feed family — likely shares a pattern set                                              |
| `config` / `settings` / `identity`                 | tbd       | tbd     | tbd     | tbd                                    | tbd                                | tbd                            | Form-heavy editors                                                                              |
| `budget` / `usage` / `gateway`                     | tbd       | tbd     | tbd     | tbd                                    | tbd                                | tbd                            | Dashboard family                                                                                |
| `approvals` / `cron` / `webhooks` / `api-explorer` | tbd       | tbd     | tbd     | tbd                                    | tbd                                | tbd                            | Tool surfaces                                                                                   |
| `docs` / `memory` / `nodes` / `routing`            | tbd       | tbd     | tbd     | tbd                                    | tbd                                | tbd                            | Misc                                                                                            |

The `tbd` rows are filled in when the corresponding `frontend-<panel>-hifi-redesign` change opens its prototype.

---

## Icons × panel summary

24 canonical icons live at `frontend-new/src/design-system/icons/index.ts`. Coverage classified per panel:

| Panel             | Domain icons used                                                                      | Action / nav icons used                                                            | Custom (non-lucide) needed |
| ----------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------- |
| `agents`          | `IconAgent` `IconBolt` `IconBook` `IconFile` `IconStream` `IconShield` `IconSubagents` | `IconArrowL` `IconCheck` `IconPlus` `IconRefresh` `IconSearch` `IconTrash` `IconX` | none                       |
| `chat` (existing) | (uses legacy frontend icons; readiness pending)                                        | —                                                                                  | tbd                        |
| (future panels)   | tbd                                                                                    | tbd                                                                                | tbd                        |

When a panel needs an icon outside this set, the panel proposal SHALL either:

- (preferred) add a new `lucide-react` re-export in `icons/index.ts` + README mapping table
- (rare) add a custom SVG under `icons/_custom/` flagged in the README mapping

---

## Atoms × panel matrix

Existing rules from `frontend-design-system-via-chat` apply. Cells inherit from the atom barrel at `frontend-new/src/design-system/atoms/index.ts` (36 atoms across action / status / streaming / container / text / form / navigation / overlay groups).

The agents pilot used: `Badge`, `Banner`, `Button`, `Card`, `Chip`, `Input`, `Modal`, `SegmentedControl`, `Spinner`, `Textarea`, `Toggle`. All `applies`. No `extend` or `missing`.

A full atom × panel grid is appended at the bottom of this file once cross-panel migration accelerates. For now we track atom usage in each panel's individual readiness audit.

---

## Reflowback candidates

Each entry below is a panel-local molecule that is **not yet** canonical because it has only one panel signal. Promotion happens only when a second panel exhibits the same shape and a separate OpenSpec change goes through the reuse-analysis gate.

### From the `agents` pilot (recorded 2026-05-04)

| Candidate    | Shape                                                                                         | Where it lives now                                                                                | Promotion criterion                                                       |
| ------------ | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `Avatar`     | Emoji / initial / image with optional accent gradient + 2 sizes                               | `agents/list-view.jsx` `.agent-row__avatar` + `agents/detail-view.jsx` `.detail-identity__avatar` | A second module ships an avatar-like surface with the same fallback chain |
| `ListRow`    | Avatar + name+tags + mono metadata triple + counts + status pill, hover/focus/selected states | `agents/list-view.jsx` `.agent-row`                                                               | Channels / models / plugins / sessions ship the same row anatomy          |
| `StatusPill` | Dot + label, tones idle/busy/error/offline with pulse animation on busy                       | `agents/styles.css` `.pill` + `.pill__dot` + `pulse` keyframe                                     | A second live-status indicator surfaces (e.g. session running state)      |
| `FileRow`    | Icon + mono name + size, hover + active states                                                | `agents/detail-view.jsx` `.file-row`                                                              | A second file-browser surface (e.g. docs / sessions transcript exports)   |

Detailed candidate dossier: `../../../frontend-handoff/design-system/proposals/2026-05-04-agents-reflowback-candidates.md`.

---

## Maintenance

Update this file whenever any of the following happens:

1. A new atom / pattern / icon is added to the design system → add the column / row, fill `applies` / `n/a` for known panels
2. A panel migration is proposed → flip its row from `tbd` to actual statuses
3. A reflowback candidate gains a second-panel signal → move it from "Reflowback candidates" to a promotion proposal entry
4. A panel migration completes and lands in `frontend-new/src/components/panels/<x>/` → annotate "(migrated)" in the panel name

Last update: 2026-05-04 (agents pilot recorded; patterns and icons columns introduced by `deck-go-frontend-foundation-readiness`).

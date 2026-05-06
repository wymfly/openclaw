# design-system / icons

Canonical icon set for `frontend-new/`. Re-exports from `lucide-react` (v1.x) under deck-go domain semantic names.

## Why this exists

- `lucide-react` ships ~1100 icons with a consistent stroke style that matches our Inter typography.
- Direct `lucide-react` imports across panels would produce inconsistent naming (`User` vs `User2` vs `UserCircle`) and tie panel code to an external library's nomenclature.
- Wrapping under semantic names (`IconAgent`, `IconStream`) gives panels a domain-meaningful API and lets us swap source library without touching consumer code.

## Rules

1. **No direct `lucide-react` imports.** Outside of this `icons/index.ts` barrel, panels and patterns MUST import from `@/design-system/icons`. Lint enforced; CI guard test verifies.
2. **No wildcard re-exports.** `export *` would defeat tree-shaking and bloat the production bundle. Each icon is a named individual re-export.
3. **No semantic-name reuse.** If an existing `IconX` no longer fits a domain meaning, deprecate it in a separate change rather than silently re-pointing it to a different lucide source.
4. **Accessibility defaults are inherited from lucide.** Default render = `aria-hidden="true"` (decorative). Pass `aria-label="..."` when the icon conveys standalone meaning.

## Mapping table

| Semantic name (this barrel) | Lucide source  | Usage                                                |
| --------------------------- | -------------- | ---------------------------------------------------- |
| `IconAgent`                 | `User`         | Agent identity in lists / hero / row avatar fallback |
| `IconAlert`                 | `AlertCircle`  | Warning / error in banners                           |
| `IconArrowD`                | `ChevronDown`  | Expand / disclosure                                  |
| `IconArrowL`                | `ChevronLeft`  | Back navigation                                      |
| `IconArrowR`                | `ChevronRight` | Forward / drill-in                                   |
| `IconArrowU`                | `ChevronUp`    | Collapse                                             |
| `IconBolt`                  | `Bolt`         | Skills / capabilities                                |
| `IconBook`                  | `BookOpen`     | System prompt / documentation                        |
| `IconCheck`                 | `Check`        | Confirm / saved state                                |
| `IconClock`                 | `Clock`        | Time / recent activity                               |
| `IconCopy`                  | `Copy`         | Copy to clipboard                                    |
| `IconEdit`                  | `Pencil`       | Edit affordance                                      |
| `IconEye`                   | `Eye`          | Show / preview                                       |
| `IconEyeOff`                | `EyeOff`       | Hide / mask                                          |
| `IconFile`                  | `FileText`     | Workspace file                                       |
| `IconFilter`                | `Filter`       | List filter                                          |
| `IconHash`                  | `Hash`         | Identifier / hash token                              |
| `IconInfo`                  | `Info`         | Informational hint                                   |
| `IconLink`                  | `Link`         | Link / bind relationship                             |
| `IconPlus`                  | `Plus`         | Create / add                                         |
| `IconRefresh`               | `RefreshCw`    | Reload / recompute                                   |
| `IconSave`                  | `Save`         | Save changes                                         |
| `IconSearch`                | `Search`       | Search input                                         |
| `IconShield`                | `Shield`       | Tool policy / security layer                         |
| `IconStream`                | `Radio`        | SSE event stream subscription                        |
| `IconSubagents`             | `Users`        | Subagent group / delegation                          |
| `IconTrash`                 | `Trash2`       | Destructive delete                                   |
| `IconUnlink`                | `Unlink`       | Unlink / detach relationship                         |
| `IconX`                     | `X`            | Close / dismiss / clear                              |

28 icons in v1. Adding a new icon: pick the closest lucide source, add a re-export to `index.ts` in alphabetical order, append a row to this table.

## Usage

```tsx
import { IconAgent, IconStream } from "@/design-system/icons";

// Decorative (next to a labeled control):
<button aria-label="Agent settings"><IconAgent size={16} /></button>

// Informative (standalone):
<IconStream size={14} aria-label="Live SSE stream" />

// With styling (color inherits, size via prop):
<IconCheck size={12} style={{ color: "var(--ds-success)" }} />
```

## Custom (non-lucide) icons

If a panel needs an icon lucide does not provide:

1. Add a custom SVG component under `icons/_custom/<icon-name>.tsx`
2. Re-export from `icons/index.ts` under the semantic `IconX` name
3. Mark the README row with "**custom**" in the source column

Custom icons are the exception, not the rule. Validate with the design-system maintainer before adding one.

## Related decisions

- `docs/project/stack-decisions.md` — `Icons → lucide-react` is locked
- `openspec/specs/design-system-icons/` — full normative requirements

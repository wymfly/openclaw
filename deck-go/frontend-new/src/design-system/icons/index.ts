/**
 * design-system icons — canonical icon exports.
 *
 * Source: lucide-react (v1.x). Re-exported under deck-go domain semantic names.
 * See `README.md` for the lucide → semantic mapping table and a11y rules.
 *
 * Rules:
 * - All icons used in panels and patterns MUST import from `@/design-system/icons`.
 * - Direct `lucide-react` imports OUTSIDE of this file are forbidden.
 * - Tree-shaking: this barrel uses individual named re-exports (not `export *`)
 *   so production bundles only ship icons actually consumed.
 * - Accessibility: lucide-react defaults to `aria-hidden="true"` when no
 *   `aria-label` prop is set. Pass `aria-label="..."` when the icon conveys
 *   standalone meaning (e.g. status pills). Pair with parent `aria-label` when
 *   the icon is a decorative companion to a labeled control.
 *
 * Adding a new icon:
 * 1. Pick the closest lucide source by browsing https://lucide.dev/icons/
 * 2. Add a re-export below in alphabetical order by semantic name
 * 3. Update README.md mapping table in the same commit
 * 4. NEVER repurpose an existing semantic name
 */

// ── Domain-meaning icons (deck-go specific) ────────────────────────────────
export { User as IconAgent } from "lucide-react"; // agent identity
export { Bolt as IconBolt } from "lucide-react"; // skill / capability
export { BookOpen as IconBook } from "lucide-react"; // system prompt / docs
export { FileText as IconFile } from "lucide-react"; // workspace file
export { Radio as IconStream } from "lucide-react"; // SSE event stream
export { Shield as IconShield } from "lucide-react"; // tool policy / security
export { Users as IconSubagents } from "lucide-react"; // subagent group

// ── Action / verb icons ────────────────────────────────────────────────────
export { Check as IconCheck } from "lucide-react"; // confirm / saved
export { Clock as IconClock } from "lucide-react"; // time / recent activity
export { Copy as IconCopy } from "lucide-react"; // copy to clipboard
export { Pencil as IconEdit } from "lucide-react"; // edit
export { Filter as IconFilter } from "lucide-react"; // filter
export { Hash as IconHash } from "lucide-react"; // identifier / hash token
export { Link as IconLink } from "lucide-react"; // link / bind
export { Plus as IconPlus } from "lucide-react"; // create / add
export { RefreshCw as IconRefresh } from "lucide-react"; // reload / recompute
export { Save as IconSave } from "lucide-react"; // save changes
export { Search as IconSearch } from "lucide-react"; // search
export { Trash2 as IconTrash } from "lucide-react"; // delete
export { Unlink as IconUnlink } from "lucide-react"; // unlink / detach
export { X as IconX } from "lucide-react"; // close / dismiss

// ── Navigation arrows ──────────────────────────────────────────────────────
export { ChevronLeft as IconArrowL } from "lucide-react"; // back
export { ChevronRight as IconArrowR } from "lucide-react"; // forward / drill
export { ChevronDown as IconArrowD } from "lucide-react"; // expand
export { ChevronUp as IconArrowU } from "lucide-react"; // collapse

// ── Visibility ─────────────────────────────────────────────────────────────
export { Eye as IconEye } from "lucide-react"; // show / preview
export { EyeOff as IconEyeOff } from "lucide-react"; // hide

// ── Status / feedback ──────────────────────────────────────────────────────
export { AlertCircle as IconAlert } from "lucide-react"; // warning / error
export { Info as IconInfo } from "lucide-react"; // info / hint

// ── Type re-export for consumer typing ─────────────────────────────────────
export type { LucideProps as IconProps } from "lucide-react";

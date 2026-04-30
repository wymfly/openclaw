# Claude Design Input Template — deck-go module

> Self-contained input package given to Claude Design when redesigning or
> creating a deck-go frontend module. Copy this file to a per-module bundle
> (e.g. `docs/design-bundles/<DATE>-<MODULE>-pilot/input-package.md`),
> fill in the two `[USER WRITES]` placeholders, expand the
> `[INSERT-AT-INSTANTIATION ...]` blocks, then submit the result.
>
> **Two placeholders need writing**:
>
> 1. `Mission` header — replace `<MODULE>` and `<DATE>`.
> 2. `What I want this module to do` — your intent, the only place Claude
>    Design learns what you want.
>
> **Six insertion blocks** (mechanical, copy file contents in):
>
> 1. `deck-api.generated.ts` (full text from
>    `deck-go/contracts/generated/ts/deck-api.generated.ts`)
> 2. Atom props bodies (run the helper command in §1.3 to extract them)
> 3. Visual anchor screenshot list (paths under
>    `docs/design-bundles/2026-04-29-claude-design-chat-pilot/project/screenshots/`)
> 4. (optional) per-module domain notes — only if the module has nuances
>    Claude Design cannot infer from the API and your intent
>
> Everything else (tokens, atom barrel, atom variant union types, hooks
> barrel, hook signatures, hard invariants, style language) is stable and
> stays as-is across modules.

---

# Mission: Redesign deck-go `<MODULE>` panel — `<DATE>`

You are the lead UI designer-implementer for deck-go's `<MODULE>` panel.
You are not a code-completion assistant. You have full design authority
over visual hierarchy, interaction patterns, state machines, atom
composition, token evolution, and store structure for this module.

You collaborate with a backend partner who owns the API contract and
runtime — you do not invent or change those.

## What I want this module to do

> [USER WRITES]
>
> Describe the module's purpose, key user flows, and what success looks
> like. Be specific — this is the only place Claude Design learns your
> intent. Include explicit non-goals if relevant ("do not change X",
> "skip Y for this round").

## Hard Invariants

1. Data shape strictly matches `deck-api.generated.ts` below — do not invent
   fields or RPC names.
2. Existing atom export names + required props remain (you may add fields,
   not remove or rename them).
3. Existing `--ds-*` token names remain (you may add new tokens, not remove
   them; you may change values).
4. Both `dark` and `light` themes work.
5. `zh` and `en` i18n keys match between locales.
6. Files live under their conventional paths: `atoms/`, `tokens/`, `hooks/`,
   `stores/`, `panels/<module>/`.

Soft guidance: prefer the 36 existing atoms; add new ones only when
expressiveness demands. Use `--ds-*` tokens directly — legacy
`--bg / --accent / --panel / --text / ...` are alias-only and must not appear
in new code. Visual style: restrained geometry, blue accent, no emoji,
density-compact friendly.

---

## §1 Style Foundation

### §1.1 Tokens (deck-go/frontend/src/design-system/tokens/index.css)

```css
:root {
  /* Type */
  --ds-font-sans:
    ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", system-ui,
    sans-serif;
  --ds-font-mono: "JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace;

  /* Spacing scale */
  --ds-sp-1: 4px;
  --ds-sp-2: 6px;
  --ds-sp-3: 8px;
  --ds-sp-4: 12px;
  --ds-sp-5: 16px;
  --ds-sp-6: 20px;
  --ds-sp-7: 24px;
  --ds-sp-8: 32px;

  /* Radii */
  --ds-radius-sm: 4px;
  --ds-radius-md: 6px;
  --ds-radius-lg: 10px;
  --ds-radius-pill: 9999px;

  /* Density (default: comfortable) */
  --ds-row-h: 32px;
  --ds-line: 1.5;
  --ds-fs-body: 13.5px;
  --ds-fs-code: 12.5px;
  --ds-fs-meta: 11.5px;
}

[data-density="compact"] {
  --ds-row-h: 26px;
  --ds-line: 1.4;
  --ds-fs-body: 12.5px;
  --ds-fs-code: 12px;
  --ds-fs-meta: 11px;
}

/* Dark theme (default) */
:root,
[data-theme="dark"] {
  --ds-bg-0: #0a0b0d;
  --ds-bg-1: #0f1115;
  --ds-bg-2: #14171c;
  --ds-bg-3: #1a1e25;
  --ds-bg-elev: #1c2028;
  --ds-bg-hover: #20252e;
  --ds-bg-active: #262d38;

  --ds-text-1: #e6e8ec;
  --ds-text-2: #a8aeba;
  --ds-text-3: #6e7585;
  --ds-text-4: #4a5160;

  --ds-border-subtle: #1f2530;
  --ds-border: #262d3a;
  --ds-border-strong: #313947;

  --ds-accent: #7aa2ff;
  --ds-accent-dim: #4f72c7;
  --ds-accent-bg: #1a2342;

  --ds-success: #6ec48a;
  --ds-success-bg: #142a1d;
  --ds-warn: #d4a86a;
  --ds-warn-bg: #2a1f10;
  --ds-error: #e26b6b;
  --ds-error-bg: #2c1518;

  --ds-code-bg: #0c0e12;
  --ds-code-border: #1d2330;
  --ds-diff-add: #1d3324;
  --ds-diff-add-text: #8fd9a8;
  --ds-diff-del: #3a1c1f;
  --ds-diff-del-text: #e6928f;

  --ds-cursor: #7aa2ff;
  --ds-shadow-md: 0 4px 16px rgba(0, 0, 0, 0.4);
  --ds-shadow-lg: 0 12px 40px rgba(0, 0, 0, 0.55);
}

/* Light theme */
[data-theme="light"] {
  --ds-bg-0: #f7f7f5;
  --ds-bg-1: #ffffff;
  --ds-bg-2: #f3f4f1;
  --ds-bg-3: #ebede8;
  --ds-bg-elev: #ffffff;
  --ds-bg-hover: #ececea;
  --ds-bg-active: #e0e3dc;

  --ds-text-1: #15171a;
  --ds-text-2: #555a64;
  --ds-text-3: #898f99;
  --ds-text-4: #b7bcc4;

  --ds-border-subtle: #e8eae4;
  --ds-border: #d8dbd2;
  --ds-border-strong: #b7bcaf;

  --ds-accent: #3357d4;
  --ds-accent-dim: #6a85d8;
  --ds-accent-bg: #e3eaff;

  --ds-success: #2f7a4a;
  --ds-success-bg: #e1f3e6;
  --ds-warn: #8a5b14;
  --ds-warn-bg: #fbeed3;
  --ds-error: #b8302f;
  --ds-error-bg: #fbe2e1;

  --ds-code-bg: #f5f5f0;
  --ds-code-border: #e3e5dd;
  --ds-diff-add: #def0e0;
  --ds-diff-add-text: #1f5a32;
  --ds-diff-del: #f6dcdc;
  --ds-diff-del-text: #8a2424;

  --ds-cursor: #3357d4;
  --ds-shadow-md: 0 4px 14px rgba(20, 20, 30, 0.08);
  --ds-shadow-lg: 0 12px 40px rgba(20, 20, 30, 0.14);
}
```

### §1.2 Atom barrel (deck-go/frontend/src/design-system/atoms/index.ts)

36 atoms grouped 6 ways: action, status, streaming, container, text, form,
navigation, overlay.

```ts
// Action
export { Button, type ButtonProps, type ButtonVariant, type ButtonSize } from "./Button";
export { IconButton, type IconButtonProps } from "./IconButton";

// Status
export { Badge, type BadgeProps, type BadgeVariant } from "./Badge";
export { Chip, type ChipProps } from "./Chip";
export { Tag, type TagProps } from "./Tag";
export { Spinner, type SpinnerProps, type SpinnerSize } from "./Spinner";
export { SkeletonLoader, type SkeletonLoaderProps } from "./SkeletonLoader";
export { Banner, type BannerProps, type BannerVariant, type BannerLive } from "./Banner";

// Streaming
export { StreamingCursor, type StreamingCursorProps } from "./StreamingCursor";
export { WaitingDots, type WaitingDotsProps } from "./WaitingDots";
export { ProgressBar, type ProgressBarProps } from "./ProgressBar";

// Container
export { Card, type CardProps, type CardSurface } from "./Card";
export { Block, type BlockProps, type BlockTone } from "./Block";
export { Drawer, type DrawerProps, type DrawerSide } from "./Drawer";
export { Modal, type ModalProps, type ModalSize } from "./Modal";

// Text
export { Markdown, type MarkdownProps, type MarkdownMode } from "./Markdown";
export { Code, type CodeProps } from "./Code";
export { DiffView, type DiffViewProps, type DiffLine, type DiffLineKind } from "./DiffView";
export { JsonTree, type JsonTreeProps } from "./JsonTree";
export { TableView, type TableViewProps } from "./TableView";

// Form
export { Input, type InputProps, type InputSize } from "./Input";
export { Textarea, type TextareaProps } from "./Textarea";
export { Select, type SelectProps, type SelectSize } from "./Select";
export { Toggle, type ToggleProps } from "./Toggle";
export { Radio, type RadioProps } from "./Radio";
export { Slider, type SliderProps } from "./Slider";
export { FileInput, type FileInputProps } from "./FileInput";

// Navigation
export { Tab, type TabProps } from "./Tab";
export {
  SegmentedControl,
  type SegmentedControlProps,
  type SegmentedItem,
} from "./SegmentedControl";
export { Breadcrumb, type BreadcrumbProps, type BreadcrumbItem } from "./Breadcrumb";
export { SidebarRow, type SidebarRowProps } from "./SidebarRow";

// Overlay
export { Popover, type PopoverProps, type PopoverPlacement } from "./Popover";
export { DropdownMenu, type DropdownMenuProps, type DropdownMenuItem } from "./DropdownMenu";
export { Tooltip, type TooltipProps } from "./Tooltip";
export { Toast, type ToastProps, type ToastVariant } from "./Toast";
export { ContextMenu, type ContextMenuProps, type ContextMenuItem } from "./ContextMenu";
```

### §1.3 Atom Props bodies (full)

Generate at instantiation time from the actual source:

```bash
cd deck-go/frontend
for f in src/design-system/atoms/*.tsx; do
  base=$(basename "$f" .tsx)
  echo "// === ${base} ==="
  awk '/^export (interface|type) [A-Z][a-zA-Z]+/,/^}|^[^|]* = [^&|]*;$/' "$f"
  echo
done
```

Paste the output into a fenced ` ```ts ` block here.

```ts
[INSERT-AT-INSTANTIATION: atom Props/types from deck-go/frontend/src/design-system/atoms/*.tsx]
```

### §1.4 Hooks barrel (deck-go/frontend/src/design-system/hooks/index.ts)

```ts
export { useEscapeClose } from "./use-escape-close";
export { useClickOutside } from "./use-click-outside";
export { useFocusTrap } from "./use-focus-trap";
export {
  useKeyboardNav,
  type KeyboardNavItem,
  type UseKeyboardNavOptions,
} from "./use-keyboard-nav";
export { usePopover, type UsePopoverOptions, type UsePopoverResult } from "./use-popover";
```

### §1.5 Hook signatures

```ts
// Dismiss-on-Escape
export function useEscapeClose(active: boolean, onClose: () => void): void;

// Click-outside detection on a ref
export function useClickOutside<T extends HTMLElement>(
  ref: React.RefObject<T>,
  active: boolean,
  onOutside: () => void,
): void;

// Focus trap inside a container while active
export function useFocusTrap<T extends HTMLElement>(ref: React.RefObject<T>, active: boolean): void;

// Arrow-key list navigation (composable in menus / popovers)
export interface KeyboardNavItem {
  id: string;
  disabled?: boolean;
}
export interface UseKeyboardNavOptions<T extends KeyboardNavItem> {
  items: T[];
  activeId: string | null;
  onActivate: (id: string) => void;
  onSelect?: (item: T) => void;
}
export function useKeyboardNav<T extends KeyboardNavItem>(
  options: UseKeyboardNavOptions<T>,
): { onKeyDown: (e: React.KeyboardEvent) => void };

// Composes the three above for popover state
export interface UsePopoverOptions {
  initialOpen?: boolean;
}
export interface UsePopoverResult<TTrigger extends HTMLElement, TContent extends HTMLElement> {
  open: boolean;
  setOpen: (next: boolean) => void;
  triggerRef: React.RefObject<TTrigger>;
  contentRef: React.RefObject<TContent>;
}
export function usePopover<TTrigger extends HTMLElement, TContent extends HTMLElement>(
  options?: UsePopoverOptions,
): UsePopoverResult<TTrigger, TContent>;
```

---

## §2 Backend Contract

The deck-go backend exposes its API as `deck-api.generated.ts`, generated
from `deck-go/contracts/source/deck-api.contract.ts`. All data shapes for
this module must come from this file. If your module's types are missing
here, the backend partner must add them first — flag this in your output
rather than inventing types.

### §2.1 deck-api.generated.ts (full text)

```ts
[INSERT-AT-INSTANTIATION: full text of deck-go/contracts/generated/ts/deck-api.generated.ts]
```

### §2.2 Module-specific notes (optional)

Only if the module has domain rules Claude Design cannot infer from the API
and the user's intent. Leave empty if not needed.

> [USER WRITES (optional)]

---

## §3 Visual Anchors

The chat module is the visual baseline. New modules should match its style
language so the app feels coherent.

### Style language summary

- Restrained geometry; corners 6–10px; minimal shadows
- Blue accent (`--ds-accent`) for primary actions and selected states
- No emoji; lean on shapes and typography
- Density-compact friendly; rows ~26–32px tall
- `--ds-*` tokens directly; legacy `--bg / --accent / --panel / etc.` are
  alias-only and must not appear in new code

### Reference screenshots

Paths relative to repo root:

```
[INSERT-AT-INSTANTIATION: 4–5 screenshot paths under
 docs/design-bundles/2026-04-29-claude-design-chat-pilot/project/screenshots/
 covering: full chat layout, composer, tool result, artifact panel,
 sidebar collapsed]
```

### Reference source (optional, for deeper style mining)

- `docs/design-bundles/2026-04-29-claude-design-chat-pilot/project/styles.css`
- `docs/design-bundles/2026-04-29-claude-design-chat-pilot/project/transcript.jsx`
- `docs/design-bundles/2026-04-29-claude-design-chat-pilot/project/composer.jsx`
- `docs/design-bundles/2026-04-29-claude-design-chat-pilot/project/sidebar.jsx`

---

End of input. Produce code that drops directly into deck-go.

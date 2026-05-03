# config — components (v2)

## Tree

```
ConfigApp                                           [app.jsx]
├─ Topbar
│  ├─ eyebrow / title / subtitle
│  ├─ unsaved/clean StatusPill
│  └─ ⌘K kbd hint
├─ SectionNav (left rail)                           [section-nav.jsx]
│  ├─ search input (filters by label/path/description)
│  └─ section item × N (icon + label + path + dirty badge)
├─ FormSection (middle column)                      [form-section.jsx]
│  ├─ head (eyebrow + title (active path) + actions)
│  ├─ HashChip strip (base → draft + section-clean / unsaved badge)
│  ├─ FormGroup (recursive)
│  │  ├─ SubsectionCard (object child)
│  │  │  └─ FormGroup (depth+1)
│  │  └─ FieldRow (leaf child: input | select | toggle | textarea | secret)
│  └─ footer (Reset draft / Preview & apply)
└─ DiffPane (right column)                          [diff-pane.jsx]
   ├─ head (eyebrow + title + 3-mode tablist [Diff | Raw | History])
   ├─ body (mode-dependent)
   │  ├─ DiffList (added/removed/modified rows)
   │  ├─ RawJsonEditor (textarea + JSON-valid pill)
   │  └─ ApplyHistory (per-row hashes + actor + paths)
   └─ footer (View snapshot)
```

## Dialogs

| Component            | Trigger                         | Body                                                                           |
| -------------------- | ------------------------------- | ------------------------------------------------------------------------------ | ------- |
| `ApplyConfirmDialog` | Footer "Preview & apply"        | base→draft hashes + 8-row diff preview + 3-phase wizard (idle → running → done | error). |
| `ResetDialog`        | Footer "Reset draft"            | warn-toned confirm with up-to-12 dirty paths listed.                           |
| `RawSnapshotDialog`  | DiffPane footer "View snapshot" | Pretty-printed `DeckGoConfigSnapshotResponse` JSON + Copy button.              |

All dialogs share `ModalShell` (Esc + backdrop click to close, focus trap on
mount).

## Local molecules

### SectionIcon

`<SectionIcon section={id} />` — picks one of `IconAgent` / `IconModel` /
`IconChannel` / `IconPlugin` / `IconHook` / `IconRuntime`. Defaults to
`IconJson` for unknown ids.

### HashChip

`<span class="hash-chip hash-chip--{tone}"><span>{kind}</span><code>{value}</code></span>`

Two tones: `accent` (current/draft) + `iron` (base). Used in form section
hash strip + apply history rows + apply-confirm dialog.

### FieldTypeBadge

`<span class="field-type field-type--{tone}">{type}</span>`

6 tones: `accent` (string), `violet` (integer/number), `success` (boolean),
`amber` (array), `magenta` (object), `iron` (any/unknown).

### RequiredDot

`<span class="required-dot">required</span>` — only renders when `required:
true`. Compact uppercase pill in error tone.

### StatusPill

`<span class="status-pill status-pill--{tone}">{Icon}{children}</span>` —
shared 5-tone pill (`iron` / `accent` / `success` / `warn` / `error`). Used
in topbar (Snapshot in sync / N unsaved), form section (section-clean /
unsaved here), raw editor (JSON valid / invalid), apply history (applied /
rejected).

### SubsectionCard

Collapsible card for object-typed schema children. Header shows chevron +
key + path + RequiredDot + per-subtree dirty count + FieldTypeBadge. Body
renders inner FormGroup recursively. Default-open at depth 0; collapsed at
depth ≥ 1.

### FieldRow

Per-leaf row. Rendered once per `DeckGoConfigLookupChild` with `hasChildren:
false`. Layout:

```
[label + RequiredDot]   [FieldTypeBadge]   [unsaved pill]
[hint description (optional)]
[code: full path]
[control: input / select / toggle / textarea / mono input]
[validation error (optional)]
```

Variants:

- `field-row--dirty` — warn-tinted left border (matches subsection's per-subtree count)
- `field-row--invalid` — error-tinted left border + visible validation message

Control selection rules (`describeType` + `hint`):

- `boolean` → `<label.ds-toggle>` with checkbox
- `hint.enum` present → `<select.ds-select>`
- `integer` / `number` → `<input.ds-input type="number">` with min/max
- `array` → `<textarea.ds-textarea--mono>` (newline-delimited)
- `hint.secret` → `<input.ds-input--mono>` with `$ENV_VAR or literal value` placeholder
- otherwise → `<input.ds-input type="text">`

Inline validation hooks (UI-only; production must bridge to schema validators):

- Required & empty → "Required."
- Integer < `hint.minimum` / > `hint.maximum` → bound message
- Secret short literal (no `$` prefix, length < 8) → "Likely too short — prefer $ENV_VAR."

## Props (production target)

```ts
type ConfigSection = {
  id: string;
  label: string;
  path: string;
  description: string;
  icon: keyof typeof SECTION_ICONS;
};

type ConfigDraftState = {
  draft: Record<string, unknown>;
  draftRaw: string;
  draftValid: boolean;
};

type ConfigSnapshot = DeckGoConfigSnapshotResponse & {
  config: Record<string, unknown>;
  raw: string;
  hash: string;
  baseHash: string;
};

type SectionNavProps = {
  sections: ConfigSection[];
  activeSection: string;
  onSelect: (id: string) => void;
  dirtyPaths: string[];
  query: string;
  onQueryChange: (q: string) => void;
};

type FormSectionProps = {
  draft: Record<string, unknown>;
  schemaLookups: Record<string, DeckGoConfigLookupResponse>;
  activeSectionPath: string;
  dirtyPaths: string[];
  onChange: (path: string, value: unknown) => void;
  onApplyOpen: () => void;
  onResetOpen: () => void;
  onRefresh: () => void;
  onTogglePreview: () => void;
  previewMode: boolean;
  baseHash: string;
  draftHash: string;
};

type DiffPaneProps = {
  baseConfig: Record<string, unknown>;
  draftConfig: Record<string, unknown>;
  draftRaw: string;
  draftValid: boolean;
  onDraftRaw: (text: string) => void;
  recentApplies: ApplyEvent[];
  now: number;
  mode: "diff" | "raw" | "history";
  onModeChange: (m: "diff" | "raw" | "history") => void;
  onOpenSnapshot: () => void;
  onSelectPath: (path: string) => void;
};

type ApplyEvent = {
  ts: number;
  actor: string;
  paths: string[];
  previousHash: string;
  newHash: string;
  ok: boolean;
  error?: string;
};
```

## Class-name intent

| Class                               | Purpose                    |
| ----------------------------------- | -------------------------- |
| `.config-app`                       | Top-level grid             |
| `.config-app__topbar`               | Header bar (lead + trail)  |
| `.config-app__layout`               | Three-column workspace     |
| `.section-nav`                      | Left rail container        |
| `.section-nav__item--on`            | Active section             |
| `.form-section`                     | Middle column container    |
| `.subsection`                       | Object subsection card     |
| `.subsection--open`                 | Expanded variant           |
| `.field-row`                        | Per-leaf form row          |
| `.field-row--dirty`                 | Unsaved variant            |
| `.field-row--invalid`               | Validation-error variant   |
| `.field-type--{tone}`               | Type badge tone (6 tones)  |
| `.hash-chip--{tone}`                | Hash chip tone variants    |
| `.diff-pane`                        | Right column container     |
| `.diff-pane__mode--on`              | Active mode tab            |
| `.diff-row--added/removed/modified` | Diff row variants          |
| `.apply-history__row--ok/err`       | Apply row variants         |
| `.modal-backdrop` / `.modal`        | Modal shell                |
| `.phase--running/done/error`        | Mutation wizard phase rows |

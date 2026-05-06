# config — high-fidelity handoff (v2)

**Status:** `implemented — real-contract verified`
**Protocol version:** `protocol-v1`
**Visual target:** [`./prototype.html`](./prototype.html) (multi-file Babel React)
**V1 archive:** [`./prototype-v1-codex.html`](./prototype-v1-codex.html)

`config/` is the **`openclaw.json` editor**. It pairs a schema-guided form
view with a raw JSON editor + diff preview + apply history, all driven by
optimistic-concurrency `baseHash` semantics. Two-pane (section nav + form)
plus a third right-hand "preview" pane that swaps between Diff / Raw / History.

## File inventory

| File                      | Purpose                                                                                                                    |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `prototype.html`          | ~26-line shell loading React + Babel + 7 jsx + 2 css.                                                                      |
| `data.js`                 | Mock fixture: realistic openclaw.json (6 top-level sections × ~30 leaves) + per-path schemaLookups + recentApplies.        |
| `icons.jsx`               | 24 SVG icons + `SectionIcon` + `HashChip` + `FieldTypeBadge` + `RequiredDot` + `StatusPill`.                               |
| `section-nav.jsx`         | Left rail: searchable list of top-level sections + per-section dirty count.                                                |
| `form-section.jsx`        | Middle column: schema-driven form (`FormGroup` + recursive `SubsectionCard` + per-leaf `FieldRow`).                        |
| `diff-pane.jsx`           | Right column: Diff / Raw JSON / Apply history (3-mode tab strip).                                                          |
| `dialogs.jsx`             | `ApplyConfirmDialog` (3-phase wizard, optimistic-concurrency banner) + `ResetDialog` + `RawSnapshotDialog` + `ModalShell`. |
| `app.jsx`                 | `ConfigApp` orchestrator + draft/snapshot state + ⌘K + dialog lifecycle.                                                   |
| `styles.css`              | Three-pane workbench + form variants + diff list + apply-history rows + modal shell.                                       |
| `tokens.css`              | Mirror of canonical `--ds-*` tokens.                                                                                       |
| `tweaks-panel.jsx`        | Design-time state knobs (theme/density/paneMode).                                                                          |
| `prototype-v1-codex.html` | Original Codex single-file prototype.                                                                                      |

## Contract truth

```ts
// from deck-go/contracts/source/deck-api.contract.ts
export type DeckGoConfigSnapshotResponse = {
  path?: string;
  exists?: boolean;
  valid?: boolean;
  raw?: string | null;
  config?: unknown;
  hash?: string;
  baseHash?: string;
};

export type DeckGoConfigApplyResponse = {
  ok?: boolean;
  baseHash?: string;
  hash?: string;
};

export type DeckGoConfigLookupChild = {
  key: string;
  path: string;
  type?: string | string[];
  required: boolean;
  hasChildren: boolean;
  hint?: Record<string, unknown>;
  hintPath?: string;
};

export type DeckGoConfigLookupResponse = {
  path: string;
  schema?: Record<string, unknown>;
  hint?: Record<string, unknown>;
  children: DeckGoConfigLookupChild[];
};
```

Endpoints:

- `GET  /api/config` → `DeckGoConfigSnapshotResponse`
- `POST /api/config/apply` → `DeckGoConfigApplyResponse`
- `POST /api/config/schema-lookup` → `DeckGoConfigLookupResponse`

Gateway method chain:

- `GET /api/config` forwards to Gateway `config.get`
- `POST /api/config/apply` forwards to Gateway `config.apply`
- `POST /api/config/schema-lookup` forwards to Gateway `config.schema.lookup`

## Form-lib stack decision (locked here)

The contract returns the **schema per path**, not as a full document — section
detail expands lazily via `schema-lookup`. v2 uses **plain `useState` +
schema-driven render** for the prototype:

| Option                      | Pros                                         | Cons                                          | Verdict                 |
| --------------------------- | -------------------------------------------- | --------------------------------------------- | ----------------------- |
| Plain `useState` + handlers | Zero deps; matches schema-per-path streaming | Manual validation wiring                      | ✅ for prototype        |
| `react-hook-form`           | Field-level subscriptions, perf at scale     | Schema is dynamic — register/unregister churn | ⏳ engineering decision |
| `formik`                    | Mature; nested fields                        | Slower for 100+ field forms; less momentum    | ❌                      |
| `@tanstack/form`            | Type-safe; field arrays first-class          | Newer; learning curve                         | ⏳ engineering decision |

**Recommendation for engineering integration**: keep the field-render contract
the prototype establishes (`schemaLookups[path].children` → leaf form rows),
then layer `react-hook-form` on top so each subsection card can register its
fields independently. Stack-decisions doc to be updated alongside the first
real implementation pass — see open question §2 below.

## Contract-reality scope correction

The **PRD originally asked** for a single multi-file form workbench backed by
"DeckGoConfigSchema". That DTO **does not exist** as a single shape — schema
is delivered per path via `DeckGoConfigLookupResponse`. v2 reflects that:

- The right pane shows **diff + raw + apply history**, not "validation report".
- Section navigation expands schema **lazily per path** in production
  (prototype precomputes for visual fidelity).
- The "stack decision" output is documented inline here in this README rather
  than a separate `api-discrepancy.md`, since the form-lib decision is
  defer-to-engineering, not a blocker.

## Depends on canonical patterns / icons

`@/design-system/patterns`:

- `PageShell`, `EmptyState`, `SectionHeader` (used implicitly by topbar +
  empty-diff card).

`@/design-system/icons`:

- `IconRefresh`, `IconSave`, `IconUndo`, `IconChevronRight`,
  `IconChevronDown`, `IconClose`, `IconCheck`, `IconAlert`, `IconLock`,
  `IconKey`, `IconJson`, `IconDiff`, `IconClock`, `IconUser`, `IconAgent`,
  `IconModel`, `IconChannel`, `IconPlugin`, `IconHook`, `IconRuntime`,
  `IconSearch`, `IconCopy`, `IconArrowOut`, `IconBan`.

`SectionIcon`, `HashChip`, `FieldTypeBadge`, `RequiredDot`, `StatusPill`
stay local to `config/`. `FieldTypeBadge` is a strong promotion candidate —
any schema-driven panel (api-explorer, webhooks) needs the same chip vocab.

## How to implement

1. Open `prototype.html` in a static server. Walk every state via the Tweaks
   panel (paneMode ∈ diff/raw/history; density compact/cozy; theme dark/light).
2. Translate to `frontend-new/src/components/panels/config/` keeping the
   class-name shape (`form-section__*`, `field-row__*`, `diff-row__*`,
   `subsection__*`).
3. Use the real fetchers in `frontend-new/src/api.ts`:
   - `fetchDeckConfig()` → `GET /api/config` → Gateway `config.get`
   - `applyDeckConfig(raw, baseHash)` → `POST /api/config/apply` → Gateway `config.apply`
   - `lookupConfigPath(path)` / `postConfigSchemaLookup({ path })` → `POST /api/config/schema-lookup` → Gateway `config.schema.lookup`
4. Hardcoded literal strings get extracted to `frontend-new/src/i18n/{en,zh}.json`
   in one pass.
5. Schema lookup is **lazy** — fire on subsection expand, not on initial load.
   Cache responses by `path`; invalidate when an apply succeeds.
6. Apply concurrency: send `baseHash`, handle 409 by re-fetching snapshot
   and showing the conflict in the apply dialog (production version of the
   `phase--error` state).

## Open questions for follow-up

1. **`recentApplies` is prototype/local-only** — there is no Deck-facing
   contract or verified BFF apply audit endpoint. Should the contract gain an
   explicit `DeckGoConfigApplyHistoryResponse`?
2. **Form-lib choice** — `react-hook-form` is the leading candidate but only
   commits when the engineering pass starts. Keep this README as the placeholder
   until then; update `docs/project/stack-decisions.md` once decided.
3. **Secret fields** — `hint.secret` is a synthetic hint the prototype assumes;
   should the contract surface `format: "env-ref"` for fields that must
   reference `$ENV_VAR`?
4. **Schema lookup batching** — production may need a batch endpoint
   (`POST /api/config/schema-lookup/batch`) for the section nav to render
   dirty counts without one round-trip per subsection.

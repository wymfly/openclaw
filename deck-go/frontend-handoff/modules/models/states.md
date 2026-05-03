# models — states

## View routing

| State         | Trigger                                                          | Notes                                                              |
| ------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------ |
| `view=list`   | initial mount, `Esc` from detail, "Models" breadcrumb            | Default.                                                           |
| `view=detail` | row click, Tweaks `Active view = detail`, `Enter` on focused row | Re-mounts DetailView on `selectedModel` change (`key={model.id}`). |

## ListView state

| State     | Description                  | UI                                                       |
| --------- | ---------------------------- | -------------------------------------------------------- |
| `ready`   | Models loaded, rows rendered | KPI strip + toolbar + provider sections.                 |
| `loading` | Refresh before any data      | Centered spinner + "Loading models…".                    |
| `error`   | `GET /models/config` failed  | Error block + Retry button; existing rows kept on retry. |
| `empty`   | No models configured         | EmptyState with "Add from catalog" CTA.                  |

The Tweaks `listState` toggles between these for design verification.

## DetailView state

| State     | Description                                                           |
| --------- | --------------------------------------------------------------------- |
| `ready`   | Hero + tabs + selected-tab body all rendered.                         |
| `loading` | Body shows single spinner; hero stays (it's derived from list cache). |
| `error`   | Body shows error block; hero stays. Retry button.                     |

Switching models resets `activeTab` to `overview`.

## Tab body states

- **Overview** — KPI tiles + provider auth row + 3-cell pricing strip.
- **Limits** — tile row with caps + reasoning/local flags + caveat
  banner.
- **Pricing** — 3-cell strip with input / output / avg-call; warn
  banner clarifying vendor invoice authority.
- **Usage** — 3 sections: provider quota windows (quota bars at
  0..100%; level=warn>60, err>80), this-model 24h spend, provider
  health.
- **Auth** — auth row + cooldown banner (if active) + OAuth tiles (if
  applicable).
- **Audit** — entries filtered to this model.

Each tab has an explicit empty-state when its source data is missing.

## Provider auth status levels

| Status     | Pill          |
| ---------- | ------------- |
| `ready`    | `pill--ok`    |
| `cooldown` | `pill--warn`  |
| `missing`  | `pill--err`   |
| `error`    | `pill--err`   |
| `unknown`  | `pill--muted` |

## Probe edge cases

- `status=ok` → ok pill + latency.
- `status=cooldown` → warn pill; latency may be 0.
- `status=unknown` → muted pill ("—").
- `status=error` → err pill; reason in `reasonCode` + `error`.

## Mutations

- Set default → PATCH runtime config; runtime re-emits
  `models.configured`; UI swaps `isDefault` flags.
- Add model from catalog → PATCH runtime config; new
  RuntimeConfiguredModel appears next cycle.
- Configure auth → PATCH runtime config; refresh `deck.auth.overview`.
- Probe → POST `deck.auth.probe`; result populates probe cache (~30s
  server-side); dialog can force a re-run.
- Edit fallback chain → PATCH config; new chain reflected next cycle.

## Responsive

- ≥1080px: 5-col KPI / 7-col row / 4-col tile-row / 3-col pricing /
  2-col catalog-grid.
- 720–1080px: 3-col KPI / 6-col row (drop max-tokens) / 2-col tile-row
  / 2-col pricing / 1-col catalog.
- <720px: 2-col KPI / 4-col row (drop context) / 1-col tile / 1-col
  pricing / 1-col catalog.

## Density

`data-density="compact"` reduces vertical padding on rows, KPI tiles,
detail tiles, audit rows, and auth rows by ≈30%.

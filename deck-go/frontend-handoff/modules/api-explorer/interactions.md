# API Explorer Interactions

## Refresh

- Refresh increments the reload trigger and calls `fetchGatewayDescribe()`.
- Refresh button is disabled while loading.
- After refresh, selected method remains stable when the method still exists.

## Method Search

- Search matches method name and scope case-insensitively.
- Method groups remain sorted by domain.
- Method rows remain sorted by method name within each domain.
- Search does not mutate the underlying loaded describe payload.

## Tabs

- Methods tab shows search, grouped methods, selected method detail, and untyped evidence.
- Events tab shows described events and payload schemas.
- Tab buttons use selected state and remain keyboard reachable.

## Schema Expand / Collapse

- Rows with nested properties/items render a native button.
- Button labels use `Collapse {name}` / `Expand {name}`.
- Rows without nested content render a placeholder only.
- Default expanded depth is shallow, keeping dense schemas scannable.

## Accessibility / Keyboard

- Method rows and schema toggles are native buttons.
- Search input has visible focus state.
- Tab buttons are native buttons with visible selected state.
- Long schema names, enum values, and method ids wrap without breaking layout.

## Visual QA Checklist

- First viewport shows describe health, counts, catalog, selected schema, and untyped evidence.
- Event tab is reachable and payload schemas render.
- Schema collapse changes row state without layout overlap.
- Mock visual screenshots are labeled as mock coverage, not upstream schema-completeness evidence.

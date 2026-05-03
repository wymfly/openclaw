# API Explorer Implementation Notes

## Implemented

- Production `ApiExplorerPanel` now uses a module-local `api-explorer-panel` contract catalog layout with a method/event catalog column and selected method schema inspector.
- Existing contract-backed data flow was preserved:
  - `fetchGatewayDescribe()`
  - `GET /api/gateway/describe`
  - `DeckGoGatewayDescribeResponse`
- The panel remains read-only. It does not add arbitrary Gateway RPC execution, direct browser-to-Gateway transport, or schema editing.
- Global `deck-ui-api-*` styling was removed from `theme.css`; API Explorer styling now lives in `api-explorer-panel.css`.
- The bundled mock Gateway now returns contract-shaped `gateway.describe` methods, events, and untyped method names so mock visual E2E can exercise the normal frontend API path.
- Existing behavior tests were updated to assert the new local class structure while preserving load/group/select/search/tab/schema-collapse/error/not-configured behavior.
- Mock visual E2E was added for ready, untyped-expanded, method-filtered, and event-tab states.

## Implementation Differences From Prototype

- The production panel keeps the current i18n copy and existing `JsonDetails` raw payload disclosure for untyped methods instead of introducing a new bespoke raw list component.
- Untyped raw method names are inside a collapsed details region by default. The E2E expands it to verify the raw evidence.
- Schema rendering continues to interpret only the existing lightweight schema keys (`type`, `enum`, `required`, `properties`, `items`) rather than adding a JSON-schema library.
- Selected method detail intentionally remains stable when the catalog search filters the left column. Filtering does not mutate the loaded contract payload or force a new selection.

## Open Follow-Ups

- Real Gateway schema completeness remains unverified by this mock visual pass. Missing `params`, `result`, or event `payload` fields must continue to render as no-schema evidence rather than fabricated schema.
- A future governed request-console proposal would need security, scope, audit, and mutation-boundary design before API Explorer can execute arbitrary RPC methods.
- Metric tile, tabbed catalog, schema tree row, selected-detail hero, and raw payload disclosure are repeated local molecules and should be evaluated in a separate design-system proposal after more contract-inspection modules converge.

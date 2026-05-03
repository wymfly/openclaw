# settings implementation notes

**Implementation status:** pending archive/commit
**Engineering surface:** `frontend-new/src/components/panels/settings/`,
`frontend-new/src/components/runtime/EndpointSection.tsx`, and
`frontend-new/src/components/runtime/ReadOnlyField.tsx`

## Production decisions

- The production panel keeps the handoff workbench shape: header status strip,
  metric tiles, endpoint/local settings/appearance cards, diagnostics,
  notification placeholders, devices, confirmation dialog, and one-time token
  dialog.
- `EndpointSection` and `ReadOnlyField` were restyled with canonical atoms and
  settings-local classes because they are settings-owned helpers today.
- The old `deck-ui-settings` global styling was removed. `settings-panel.css`
  owns the module shell with existing `--ds-*` tokens.
- Mock Gateway device methods were added for visual E2E only:
  `device.pair.list`, approve/reject/remove, and token rotate/revoke.

## Contract corrections

- The handoff originally described immutable endpoint testing as
  `testEndpoint(undefined)`. Fresh mock-stack verification showed bundled mode
  returns `endpoint_not_mutable` for `POST /runtime/endpoint:test`.
- Production now hides endpoint testing when `endpointMutable=false`. Remote
  mutable endpoint save/test behavior and the `__unchanged__` token sentinel are
  preserved by unit tests.

## Design-system feedback

- Repeated local molecules after settings: metric tile, secure read-only field,
  status/action rows, device row, token row, and confirmation/token dialogs.
- Security/config molecules should remain local until another configuration
  module repeats the same shape. The best promotion candidates are
  `SecureReadOnlyField` and a compact device/token action row.

## Verification evidence

- `npm run test:deck-ui -- src/components/panels/settings`
- `pnpm exec playwright test --config deck-go/playwright.config.ts deck-go/test/e2e/settings-visual.spec.ts`

## Context

`deck-go/frontend-handoff/modules/settings/` contains a revised v2 prototype for operator preferences, runtime endpoint state, device pairing, and version diagnostics. The production `frontend-new` Settings panel already consumes BFF wrappers for settings, runtime endpoint, version, devices, and stream events, and `settings-visual.spec.ts` covers mock visual behavior.

Current verified contract facts:

- Browser code must call only deck-go backend routes.
- Settings read/write uses `GET /settings` and `PUT /settings` through `fetchSettings` and `saveSettings`. Some handoff text still says `POST /settings`, which is stale.
- Settings connection test uses `POST /settings/test-connection`.
- Version uses `GET /settings/version`.
- Bootstrap/runtime context uses `GET /bootstrap/status`, `GET /runtime/gateway`, `GET /runtime/capabilities`, `GET /runtime/endpoint`, `PUT /runtime/endpoint`, and `POST /runtime/endpoint:test`.
- Runtime endpoint mutation is allowed only when capabilities say the endpoint is mutable; bundled mode is read-only for endpoint fields because `.env` and supervisor state own them.
- Device pairing/token routes are already represented by frontend wrappers and the existing settings mock visual test, but paired device DTO shape remains partly open.

## Goals / Non-Goals

**Goals:**

- Audit Settings against the full BFF/DTO/frontend/mock/E2E contract chain.
- Fix deterministic Settings-scoped drift directly when behavior and source ownership are clear.
- Preserve the v2 workbench skeleton and token-safety posture.
- Add bounded L2 real-stack evidence for settings, runtime, endpoint, version, safe device reads/actions when available, and BFF-only browser access.
- Record workflow classifications and residual risks in `frontend-handoff/modules/settings/implementation-notes.md`.
- Keep OpenSpec tasks, verification evidence, and archive readiness in sync.

**Non-Goals:**

- No new token rotation, settings audit, keybinding, privacy, or bundled `.env` mutation endpoints.
- No direct Gateway calls from browser code.
- No new frontend dependencies or broad design-system atom promotion.
- No unsafe real device mutation, endpoint mutation, or token disclosure solely for E2E.
- No broad runtime-mode architecture rewrite outside deterministic Settings drift.

## Decisions

1. **Use BFF/runtime code truth as authority and v2 as product target.**
   Production should keep the v2 workbench direction, but active behavior is limited to current wrappers, BFF routes, runtime capability flags, DTOs, and documented projections.

2. **Enforce bundled-mode read-only behavior at UI and BFF boundaries.**
   The Settings panel should hide or disable endpoint mutations when endpoint mutability is false. Real E2E should verify bundled read-only behavior without attempting unsafe mutation unless the route is explicitly expected to reject.

3. **Correct stale route truth instead of preserving handoff wording.**
   Current code uses `PUT /settings`, not `POST /settings`; `POST /runtime/endpoint:test` is exposed in frontend as `/runtime/endpoint:test`, not `/runtime/endpoint/test`.

4. **Real-stack verification is bounded and operator-safe.**
   L2 should verify read routes and UI boundary first. Endpoint update, device actions, and token rotation are skipped-safe unless controlled inputs and safety can be proven.

5. **Fix deterministic drift during the audit.**
   Clear mismatches in wrappers, endpoint classification, UI metadata, mocks, handoff docs, tests, or local validation should be fixed in the source-owned layer with focused evidence.

## Risks / Trade-offs

- **Real Gateway/runtime startup may be environment-dependent** -> Use the three-attempt circuit breaker and keep static review, focused tests, mock visual evidence, and build/contract checks mandatory.
- **Endpoint mutation can change operator connectivity** -> Prefer read-only L2 checks; only verify rejection or no-op-safe paths in bundled mode.
- **Token/device actions are security-sensitive** -> Keep destructive actions gated, self-device destructive actions disabled, and one-time tokens visible only in the dedicated dialog.
- **Open DTOs can encourage fabricated fields** -> Record paired-device, notifications, and appearance assumptions as open or projected when not guaranteed by the DTO.

## Open Questions

- Whether `pairedDevices` should become a typed `DeckGoPairedDevice` in the Deck-facing contract.
- Whether settings save history/recent saves should have a real BFF route.
- Whether token rotation belongs in Settings or Devices as a formal contract endpoint.
- Whether keybindings/privacy should remain deferred or become typed settings subtrees.

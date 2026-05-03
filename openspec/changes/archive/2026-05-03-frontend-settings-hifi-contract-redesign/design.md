## Context

`frontend-new` already has a functional `SettingsPanel` with local settings load/save, endpoint display/mutation/test, version diagnostics, theme and locale controls, notification placeholder copy, device pairing, token rotation/revocation, and device SSE refresh. Its primary data boundaries are BFF-owned Deck control-plane endpoints rather than direct Gateway RPC traffic.

Exploration did not find a deterministic contract-forwarding drift in the current settings BFF routes. The security-sensitive boundary is that `GET /settings` reports access-token configured/source state but does not return token values, and `PUT /settings` rejects runtime-managed fields. The endpoint route uses the explicit `__unchanged__` sentinel to preserve configured tokens without exposing them.

The current panel still uses old broad `deck-ui-settings` selectors, native button/input styling, and no handoff package. `EndpointSection` and `ReadOnlyField` are currently only used by Settings, so they can be restyled with the same module pass without changing another panel.

## Goals / Non-Goals

**Goals:**

- Produce a complete settings handoff package.
- Rewrite settings into a compact configuration/security workbench aligned with the settled design-system posture.
- Preserve current save, refresh, endpoint, device action, token confirmation, and SSE refresh behavior.
- Keep token values masked or absent except the one-time rotated token dialog.
- Add mock visual coverage and update design-system readiness evidence.

**Non-Goals:**

- No real Gateway/LLM E2E.
- No new persisted notification-preference API.
- No change to rejected settings fields or runtime-managed field policy.
- No direct Gateway RPC calls from browser code.
- No new dependencies.
- No design-system atom promotion inside this module change.

## Decisions

1. **Treat Settings as a BFF control-plane workbench.**
   The UI should make settings/runtime/devices contract boundaries visible, but browser code continues through the existing API facade.

2. **Keep endpoint tokens non-revealing.**
   Configured token state is rendered as configured/not configured. Editable remote endpoint token input remains empty with the unchanged sentinel behavior. Rotated device token is the only visible token, and only in the existing one-time modal.

3. **Include settings-only runtime helpers in the pass.**
   `EndpointSection` and `ReadOnlyField` currently belong to the settings visual surface. Styling them through canonical atoms/local classes removes the old global settings CSS without changing route contracts.

4. **Keep notification preferences as placeholders.**
   The panel can show notification scopes, but must not imply that notification preferences are persisted until a contract exists.

5. **Keep device management action-gated.**
   Approve/reject/remove/revoke/rotate actions retain confirmation dialogs and disabled self-device destructive actions.

## Risks / Trade-offs

- **Risk: Security regression through token display.** -> Preserve tests that ensure settings responses do not leak tokens and add UI assertions that configured tokens render as status only.
- **Risk: Overloading the first viewport.** -> Use metric/status strip plus focused cards: runtime endpoint, local settings, appearance/locale, devices, diagnostics.
- **Risk: Endpoint helper restyle affects other modules.** -> Current usage is settings-only; if usage widens during implementation, pause and scope the helper change carefully.
- **Risk: Mock visual coverage is mistaken for real device pairing proof.** -> Label evidence as mock visual coverage only.

# Approvals

**Status**: implemented-awaiting-archive
**Design completed**: 2026-05-03
**Designer**: Codex single-agent replacement workflow
**Depends on atoms**: Button, Select, Input, Textarea, Toggle/Checkbox, Badge/Pill, Card, Code/Json detail, Status, Spinner
**New atoms needed**: none
**New tokens needed**: none
**Backend endpoints used**: see `api-usage.md`

## What this module does

Approvals is the Automate workspace for security-sensitive exec and plugin decisions. It lets an operator inspect pending exec approvals, plugin approval requests, policy defaults, per-agent overrides, allowlist paths, live approval events, decision results, and raw policy/action evidence.

This package is a high-fidelity handoff for `deck-go/frontend-new/src/components/panels/approvals/`. It is based on the current deck-go contract chain and production behavior. Code and contracts remain the source of truth; this prototype is an implementation guide.

## Contract truth

- Frontend wrappers: `fetchApprovalsPolicy`, `fetchPendingApprovals`, `fetchPluginApprovals`, `resolveApproval`, `resolvePluginApproval`, and `updateApprovalsPolicy`.
- BFF endpoints: `GET /api/approvals/policy`, `PUT /api/approvals/policy`, `GET /api/approvals/pending`, `POST /api/approvals`, `GET /api/approvals/plugins`, and `POST /api/approvals/plugins`.
- Stream source: `streamEvents` carrying `approval.pending` and `approval.resolved` events into `useApprovalsStream`.
- Backend source: Go BFF approval routes -> managed runtime approval surface -> Gateway approval queries.
- Typed Gateway methods: `exec.approvals.get`, `exec.approvals.set`, `exec.approval.resolve`, and `plugin.approval.resolve`.
- Untyped upstream-schema exceptions: `exec.approval.list` and `plugin.approval.list`.
- DTO authority: `DeckGoApprovalPolicy`, `DeckGoApprovalPolicyResponse`, `DeckGoPendingApproval`, `DeckGoPendingApprovalsResponse`, `DeckGoPluginApprovalEntry`, and `DeckGoPluginApprovalsResponse`.
- Browser code must continue to call the Go BFF wrappers only; it must not call Gateway directly.

## How to implement

1. Open `prototype.html` and inspect the approval operations layout, exec queue, plugin queue, selected approval detail, policy controls, allowlist controls, and last action detail.
2. Read `components.md` for module-local component structure and data boundaries.
3. Read `states.md` for loading, ready, empty, error, stream, decision, policy, and action states.
4. Read `interactions.md` for selection, exec/plugin switching, decisions, navigation, policy edits, allowlist edits, agent overrides, stream updates, and refresh behavior.
5. Read `api-usage.md` and preserve the current BFF path and mutation envelopes.
6. Read `implementation-notes.md` for the production migration notes and verified mock/local visual coverage.

## Open questions for implementation

- Mock visual E2E likely needs additional mock Gateway support for `exec.approval.resolve`, `exec.approvals.set`, `plugin.approval.list`, and `plugin.approval.resolve`.
- `exec.approval.list` and `plugin.approval.list` remain upstream-schema-missing methods; real Gateway list semantics are not fully proven by mock/local visual tests.
- A full policy schema IDE, approval audit timeline, multi-step approval workflow, and real external security assurance are out of scope for this pass.

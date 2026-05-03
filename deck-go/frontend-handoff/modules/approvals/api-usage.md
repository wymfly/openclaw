# Approvals API Usage

## Source Truth

- Deck-facing DTO source: `deck-go/contracts/source/deck-api.contract.ts`
- Browser endpoint metadata: `deck-go/contracts/source/deck-endpoints.contract.json`
- UI metadata: `deck-go/contracts/source/deck-ui.contract.json`
- Frontend wrappers: `deck-go/frontend-new/src/api.ts`
- Backend routes: `deck-go/backend/internal/api/http/admin.go`
- Managed runtime surface: `deck-go/backend/internal/runtime/openclaw/managed_runtime.go`
- Gateway adapter: `deck-go/backend/internal/runtime/openclaw/gateway_queries.go`

## Read Routes

### `fetchApprovalsPolicy()`

- Route: `GET /api/approvals/policy`
- Response: `DeckGoApprovalPolicyResponse`
- Used for policy hash, defaults, per-agent overrides, allowlist paths, and raw policy evidence.

### `fetchPendingApprovals()`

- Route: `GET /api/approvals/pending`
- Response: `{ pending: DeckGoPendingApproval[] }`
- Used for exec approval queue, selected fallback, command/cwd/agent/session/run evidence, and decision actions.
- Gateway source currently uses untyped `exec.approval.list`.

### `fetchPluginApprovals()`

- Route: `GET /api/approvals/plugins`
- Response: `DeckGoPluginApprovalsResponse`
- Used for plugin approval queue, selected plugin approval evidence, and plugin decision actions.
- Gateway source currently uses untyped `plugin.approval.list`.

## Mutation Routes

### `resolveApproval(id, decision)`

- Route: `POST /api/approvals`
- Body: `{ id, decision }`
- Response: record-like decision result
- Decisions are currently `allow-once`, `allow-always`, or `deny`.

### `resolvePluginApproval(id, decision)`

- Route: `POST /api/approvals/plugins`
- Body: `{ id, decision }`
- Response: record-like plugin decision result

### `updateApprovalsPolicy(file, baseHash)`

- Route: `PUT /api/approvals/policy`
- Body: `{ file, baseHash? }`
- Response: record-like policy update result, usually with policy hash/file evidence

## Stream Events

### `approval.pending`

- Adds a pending approval when the event payload can be normalized into `DeckGoPendingApproval`.
- The UI should ignore malformed events rather than fabricating queue rows.

### `approval.resolved`

- Removes a pending approval by id.
- If the selected approval is resolved, the UI should clear or fall back without breaking the plugin queue or policy editor.

## Boundaries

- Browser code must not call Gateway directly.
- The production UI should not fabricate command argv, cwd, agent id, session key, run id, plugin description, decision, status, created time, expiry, or policy hash when the DTO omits them.
- Mock/local visual tests may extend the mock Gateway fixture for deterministic approval and plugin approval evidence, but those fixtures are not real Gateway/LLM or full security assurance.

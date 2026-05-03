# Approvals States

## Loading

- Queue column shows `Approvals loading` with stable metric shells.
- Detail column shows a neutral selected-state placeholder.
- Policy editor regions should not resize abruptly when data arrives.

## Ready

- Queue column shows pending exec count, active plugin pending count, allowlist count, agent override count, and the active surface.
- Detail column shows selected exec or plugin approval evidence, decision actions, policy state, and raw payload details.
- The first viewport should expose queue, decision, and policy evidence without nested decorative cards.

## Empty

- Exec queue shows no pending approvals.
- Plugin queue shows no plugin approvals.
- Policy state remains visible even when both queues are empty.

## Error

- Read or action errors render as inline evidence near the relevant workbench region.
- Existing queue and policy data remains visible if possible.
- Errors must wrap so long Gateway messages do not overflow.

## Exec Surface

- Selected exec approval shows command, id, agent, session, run, cwd, created time, expires time, navigation actions, and raw payload.
- Decision controls call `resolveApproval`.

## Plugin Surface

- Selected plugin approval shows plugin id, request id, command, description, status, decision, created time, expires time, and raw payload.
- Decision controls call `resolvePluginApproval` only when the selected plugin approval is unresolved and unexpired.

## Policy Editing

- Structured controls edit the same policy draft as the raw JSON textarea.
- Invalid JSON shows policy-invalid evidence and blocks save.
- Save calls `updateApprovalsPolicy(policy, hash)` with the current base hash when available.

## Stream Updates

- `approval.pending` adds a row when the payload is valid and unexpired.
- `approval.resolved` removes the matching row by id.
- Selected approval fallback remains stable when possible.

## Decision Result

- Decision action disables only decision controls while in flight.
- Last action raw detail shows the result.
- Refresh reloads queue and policy/plugin data through the existing wrappers.

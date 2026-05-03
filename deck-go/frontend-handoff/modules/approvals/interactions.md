# Approvals Interactions

## Select Exec Approval

1. Operator chooses a pending exec approval row.
2. UI sets `selectedApprovalId`.
3. Detail column shows command, agent/session/run, timestamps, navigation actions, and raw payload.

## Select Plugin Approval

1. Operator switches to Plugin approvals.
2. Operator chooses a plugin approval row.
3. UI sets `selectedPluginApprovalId`.
4. Detail column shows plugin status, decision, timestamps, description, and raw payload.

## Refresh

1. Operator clicks refresh.
2. UI calls `fetchApprovalsPolicy`, `fetchPendingApprovals`, and `fetchPluginApprovals`.
3. UI preserves selected exec/plugin approvals if they still exist.

## Decide Exec Approval

1. Operator selects an exec approval.
2. Operator clicks Allow once, Allow always, or Deny.
3. UI calls `resolveApproval(selectedId, decision)`.
4. UI refreshes data, preserves preferred selection when still available, and shows last action raw detail.

## Decide Plugin Approval

1. Operator selects an unresolved and unexpired plugin approval.
2. Operator clicks Allow once, Allow always, or Deny.
3. UI calls `resolvePluginApproval(selectedId, decision)`.
4. UI refreshes plugin data and shows last action raw detail.

## Open Agent / Session

1. Operator clicks Open approval agent or Open approval session.
2. UI calls the existing shared deck navigation helpers.
3. No approval decision is made by navigation.

## Edit Policy Defaults

1. Operator changes global or per-agent security/ask/fallback/auto-allow controls.
2. UI updates the structured policy draft and raw JSON textarea.
3. Save calls `updateApprovalsPolicy` with the current base hash.

## Manage Agent Overrides

1. Operator enters an agent id and adds an override.
2. UI creates an empty per-agent defaults object if it does not already exist.
3. Operator can remove the override without affecting global defaults.

## Manage Allowlist Paths

1. Operator enters a path and adds it to allowlist.
2. UI ignores empty or duplicate paths.
3. Operator can remove a path from the draft before saving.

## Stream Update

1. UI receives `approval.pending`.
2. UI appends the pending approval if valid and unexpired.
3. UI receives `approval.resolved`.
4. UI removes the matching pending approval and clears selection if needed.

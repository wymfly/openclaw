# Approvals Components

## Component Tree

```text
ApprovalsPanel
  ApprovalWorkbench
    QueueColumn
      ApprovalHeader
      ApprovalMetrics
      ApprovalSurfaceTabs
      DecisionActionBar
      PendingApprovalList
        PendingApprovalRow
      PluginApprovalList
        PluginApprovalRow
    DetailColumn
      SelectedApprovalHero
      SelectedApprovalFacts
      NavigationActions
      ApprovalPayloadDetail
      PluginApprovalPayloadDetail
      PolicySummaryPanel
      PolicyEditorPanel
        PolicyDefaultsControls
        AgentOverrideList
        PathAllowlist
        PolicyJsonEditor
      LastActionDetail
```

## Module-Local Molecules

### Approval header

- Shows title, contract description, load state, pending count, plugin pending count, allowlist count, and agent override count.
- Reuses prior workbench header rhythm but keeps security-specific labels local.

### Approval metric tile

- Compact tile for pending exec approvals, plugin pending approvals, allowlisted paths, and agent overrides.
- Repeats prior metric tile molecules but remains local until a dedicated KPI/card proposal defines a shared API.

### Pending approval row

- Button row with command, id, agent id, session key, run id, cwd, created/expiry evidence, and selected state.
- Long commands and paths wrap inside stable constrained regions.

### Plugin approval row

- Button row with plugin id, request id, command, description, status, decision, created/expiry evidence, and selected state.
- Resolved or expired entries remain visible as evidence but are not actionable.

### Decision action bar

- Contains refresh, allow once, allow always, and deny controls for the active surface.
- Disabled states must reflect selected approval availability and action in flight.

### Policy summary and editor

- Shows global defaults, per-agent overrides, allowlist paths, base hash, and raw policy JSON.
- Keeps structured controls and raw JSON editor connected to the same draft.

### Stream evidence

- Shows that live `approval.pending` and `approval.resolved` events update the exec queue.
- This remains module-local until a broader live-event pattern is proposed.

### Last action detail

- Uses raw JSON disclosure for decision and policy-save responses.
- The raw payload is evidence, not primary navigation.

## Props / Data Boundaries

The production implementation may keep helper components under `src/components/panels/approvals/`. It should not widen public APIs. All data remains internal to `ApprovalsPanel` and is sourced from existing `src/api.ts` wrappers plus `useApprovalsStream`.

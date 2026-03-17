## ADDED Requirements

### Requirement: Pending Approvals Management

The approval panel SHALL display all pending execution approvals and allow the user to approve or deny each one via the `exec.approval.resolve` Gateway RPC.

#### Scenario: List pending approvals

- **WHEN** the user navigates to the Approvals panel
- **THEN** the panel SHALL call `exec.approvals.get` and display all pending approvals with the requesting agent, command description, and timestamp

#### Scenario: Approve an execution

- **WHEN** the user clicks "Approve" on a pending approval
- **THEN** the panel SHALL call `exec.approval.resolve` with an approve action and the approval SHALL be removed from the pending list

#### Scenario: Deny an execution

- **WHEN** the user clicks "Deny" on a pending approval
- **THEN** the panel SHALL call `exec.approval.resolve` with a deny action and the approval SHALL be removed from the pending list

### Requirement: Approval Policy Configuration

The panel SHALL expose the actual 4-dimensional approval policy model via `exec.approvals.set`:

1. **security**: `deny` (deny all) / `allowlist` (allow listed paths only) / `full` (allow everything)
2. **ask**: `off` (never ask) / `on-miss` (ask when command not in allowlist) / `always` (always ask)
3. **askFallback**: `deny` (deny if user unreachable) / `allow` (allow if user unreachable)
4. **autoAllowSkills**: `boolean` (auto-allow skill-declared CLI commands)

#### Scenario: Set approval policy

- **WHEN** the user configures the 4 policy dimensions and clicks "Save"
- **THEN** the panel SHALL call `exec.approvals.set` with `{ security, ask, askFallback, autoAllowSkills }` and display a confirmation

### Requirement: Per-Agent Security Policy

The panel SHALL allow configuring per-agent security policies that override the global 4-dimensional policy.

#### Scenario: Set agent-specific policy

- **WHEN** the user selects policy values for a specific agent
- **THEN** the panel SHALL persist the per-agent policy via `exec.approvals.set` scoped to that agent, using the same 4-dimensional model

### Requirement: Path Allowlist Management

The panel SHALL provide a path allowlist editor for specifying directories and files that agents are permitted to access without explicit approval.

#### Scenario: Add path to allowlist

- **WHEN** the user adds a path entry to the allowlist
- **THEN** the panel SHALL persist the allowlist update and subsequent executions accessing that path SHALL not require approval (if the policy permits)

#### Scenario: Remove path from allowlist

- **WHEN** the user removes a path entry from the allowlist
- **THEN** the panel SHALL remove the entry and subsequent executions accessing that path SHALL require approval per the active policy

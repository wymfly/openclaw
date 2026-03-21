## ADDED Requirements

### Requirement: Install skill via UI

The SkillsPanel SHALL provide an "Install" action that allows users to install new skills from the available registry.

#### Scenario: Install a skill

- **WHEN** user clicks "Install Skill" button and selects a skill from the available list
- **THEN** system calls `skills.install({ name, version })` and shows a progress indicator
- **AND** on success, the skill appears in the installed list with "just installed" badge

#### Scenario: Install with specific version

- **WHEN** user selects a skill and specifies a version in the install dialog
- **THEN** system installs that specific version; latest is used if no version specified

#### Scenario: Install failure

- **WHEN** `skills.install` returns an error (network, permission, dependency conflict)
- **THEN** system shows error toast with the failure reason and the install dialog remains open for retry

### Requirement: Uninstall skill via UI

Each installed skill SHALL have an "Uninstall" action with confirmation.

#### Scenario: Uninstall a skill

- **WHEN** user clicks "Uninstall" on an installed skill and confirms the dialog
- **THEN** system calls the uninstall operation and removes the skill from the list on success

#### Scenario: Uninstall confirmation shows usage

- **WHEN** user clicks "Uninstall" on a skill that is assigned to agents
- **THEN** the confirmation dialog shows "此技能当前被 N 个 Agent 使用" with the agent list, requiring explicit confirmation

### Requirement: Update skill via UI

Installed skills with available updates SHALL show an "Update" action.

#### Scenario: Update available indicator

- **WHEN** an installed skill has a newer version available
- **THEN** the skill card shows an update badge with the available version number

#### Scenario: Update a skill

- **WHEN** user clicks "Update" on a skill with available update
- **THEN** system calls `skills.update({ name })` and shows progress; on success, version badge updates

#### Scenario: Bulk update

- **WHEN** multiple skills have available updates
- **THEN** a "Update All" button appears at the top of the skill list; clicking it sequentially updates all outdated skills

### Requirement: Skill detail view with metadata

Selecting a skill SHALL display a detail view with Info and Config tabs.

#### Scenario: View skill info

- **WHEN** user selects a skill in the list
- **THEN** the right panel shows an "Info" tab with: name, version, description, author, homepage URL, installed date, and size

#### Scenario: View skill dependencies

- **WHEN** the Info tab is displayed
- **THEN** a "Dependencies" section lists the skill's required dependencies with their version constraints and installed status (✅ met / ❌ missing)

#### Scenario: View required environment variables

- **WHEN** the Info tab is displayed and the skill declares required env vars
- **THEN** an "Environment Variables" section lists each variable with name, description, and status (✅ set / ⚠️ not set)

#### Scenario: Config tab preserves existing behavior

- **WHEN** user switches to the "Config" tab
- **THEN** the existing SkillConfig component renders as before, allowing skill-specific configuration editing

### Requirement: Enhanced SkillMatrixTab with visual assignment

The SkillMatrixTab SHALL display an interactive Agent × Skill cross-table with click-to-toggle assignment.

#### Scenario: Display skill matrix

- **WHEN** user navigates to the "Agent Assignment" tab
- **THEN** system renders a matrix table: rows = agents, columns = skills; cells show ✅ (assigned), ❌ (not assigned), or ⚪ (ineligible)

#### Scenario: Toggle skill assignment

- **WHEN** user clicks a ✅ or ❌ cell in the matrix
- **THEN** system toggles the assignment via the existing `deck.agents.skills.set` RPC and updates the cell immediately (optimistic update)

#### Scenario: Ineligible skill

- **WHEN** a skill is ineligible for an agent (e.g., missing dependency)
- **THEN** the cell shows ⚪ (gray) and click shows tooltip explaining why the skill cannot be assigned

#### Scenario: Matrix filter

- **WHEN** user types in the search box above the matrix
- **THEN** both agent rows and skill columns are filtered to match the search term

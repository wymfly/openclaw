## ADDED Requirements

### Requirement: frontend-new must provide a minimal multi-panel shell

`deck-go/frontend-new/` SHALL provide a minimal panel shell that can render chat and agents within the same Vite workspace. The shell MUST preserve the existing `?dsGallery=1` design-system gallery route and MUST NOT require a new routing dependency.

#### Scenario: Default route still opens chat

- **WHEN** the browser opens `http://localhost:5175/` without a panel selector and without `?dsGallery=1`
- **THEN** the workspace SHALL render the chat panel by default

#### Scenario: Agents route opens agents panel

- **WHEN** the browser opens the stable agents selector URL or the user activates agents from the shell navigation
- **THEN** the workspace SHALL render the agents panel
- **AND** the active panel state SHALL be reflected in the URL or another stable browser-visible state so the view can be reopened directly

#### Scenario: Design system gallery remains isolated

- **WHEN** the browser opens `http://localhost:5175/?dsGallery=1`
- **THEN** the design system gallery SHALL render instead of the business panel shell

### Requirement: frontend-new panel shell must remain lightweight and replaceable

The initial panel shell SHALL be data-driven enough to add agents without editing unrelated chat internals, but it MUST remain small and replaceable by a future router or full application shell.

#### Scenario: Adding agents does not modify chat component internals

- **WHEN** the agents panel is registered in the workspace shell
- **THEN** existing chat panel component internals SHALL NOT need changes for agents navigation to work

#### Scenario: No routing dependency is introduced

- **WHEN** package manifests are inspected after this change
- **THEN** no new router package SHALL be added solely for chat/agents switching

## REMOVED Requirements

### Requirement: panels/ 目录必须为空（等待 chat 迁移）

**Reason**: This requirement described the scaffold-only state before business modules entered `frontend-new`. Chat has already migrated, and agents is now the second business panel.

**Migration**: `frontend-new/src/components/panels/` now contains implemented panel directories. Completion is verified by build/tests and panel shell scenarios rather than by requiring the directory to be empty.

## ADDED Requirements

### Requirement: frontend-new must provide the complete active deck-go frontend surface

`deck-go/frontend-new/` SHALL be the active, complete deck-go frontend workspace. It MUST render the restored full deck-ui host and all current deck-go panels, while retaining protocol-v1 workspace structure, design-system authority, generated contract facades, and the `src/components/panels/<module>/` module layout.

#### Scenario: Normal route boots the full host

- **WHEN** the browser opens `frontend-new` without `?dsGallery=1`
- **THEN** the application SHALL boot the full deck-ui host rather than a scaffold placeholder or a two-panel-only shell
- **AND** the default active panel SHALL be `chat`

#### Scenario: Design system gallery remains isolated

- **WHEN** the browser opens `frontend-new` with `?dsGallery=1`
- **THEN** the design-system gallery SHALL render instead of the business panel shell
- **AND** the business panel registry SHALL NOT be required for the gallery route to render

### Requirement: frontend-new may use frozen frontend only as migration reference

`deck-go/frontend/` SHALL remain a frozen reference workspace. New active frontend work MUST land in `deck-go/frontend-new/`. During this preservation change, `frontend` MAY be read and copied from as a source of already-working deck-go UI behavior, but it MUST NOT become the active dev script target or receive new feature work.

#### Scenario: Dev scripts target frontend-new

- **WHEN** deck-go frontend dev or preview scripts are used for the active product surface
- **THEN** they SHALL target `deck-go/frontend-new`
- **AND** they SHALL NOT require running `deck-go/frontend` for the same UI to be available

#### Scenario: Frozen frontend remains reference-only

- **WHEN** a preserved panel is restored into `frontend-new`
- **THEN** the corresponding source under `frontend` SHALL remain reference-only
- **AND** follow-up fixes SHALL be made in `frontend-new` unless explicitly requested as legacy maintenance

### Requirement: frontend-new verification covers restored host and preserved panels

`frontend-new` SHALL verify more than scaffold viability. Its build/test verification MUST cover the restored host, full panel inventory, new-authority `chat` and `agents`, and representative preserved panels.

#### Scenario: Build includes restored panel graph

- **WHEN** `cd deck-go/frontend-new && npm run build` runs
- **THEN** TypeScript and Vite SHALL compile the restored host and all registered panels
- **AND** no registered preserved panel SHALL be excluded from compilation by a placeholder-only shortcut

#### Scenario: Test suite includes host and panel preservation checks

- **WHEN** `cd deck-go/frontend-new && npm run test:deck-ui` runs
- **THEN** the test suite SHALL include host/registry checks and focused tests for new `chat`/`agents` plus preserved panel smoke behavior

## REMOVED Requirements

### Requirement: panels/ 目录必须为空（等待 chat 迁移）

**Reason**: This scaffold-era requirement is no longer true. `chat` has migrated into `frontend-new`, `agents` has been rebuilt in `frontend-new`, and the active workspace now needs to preserve the complete frozen `frontend` product surface.

**Migration**: `frontend-new/src/components/panels/` becomes the active module directory for all panels. `chat` and `agents` are new-authority modules; all other current frozen `frontend` panels are restored as preserved modules.

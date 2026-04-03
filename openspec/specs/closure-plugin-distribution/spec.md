# closure-plugin-distribution Specification

## Purpose
TBD - created by archiving change openspec-closure-plugin-distribution. Update Purpose after archive.
## Requirements
### Requirement: The closure companion SHALL be installable as a product bundle instead of only as repo-local scripts

Pluginized distribution SHALL provide the closure executable and workflow assets without requiring each project to vendor the companion core.

#### Scenario: Codex bundle exposes closure execution without repo-local scripts

- **scenario_id**: `closure-plugin-distribution.codex-bundle-exec`
- **WHEN** a user installs the Codex-facing closure companion bundle
- **THEN** the bundle SHALL provide an executable closure entrypoint plus `openspec-closure-workflow`
- **AND** it SHALL NOT require the target project to copy `scripts/openspec-closure.ts` or companion library files into the repository

#### Scenario: Claude bundle mirrors the same closure workflow contract

- **scenario_id**: `closure-plugin-distribution.claude-bundle-parity`
- **WHEN** a user installs the Claude-facing closure companion bundle
- **THEN** it SHALL expose the same `openspec-closure-workflow` lifecycle semantics as the Codex bundle
- **AND** it SHALL NOT depend on any single project's local companion core files

### Requirement: Installed bundles SHALL remain usable across projects and worktrees

The installation model SHALL support repeated reuse in another project or worktree without re-vendoring the companion core.

#### Scenario: Same installed bundle works in a new worktree

- **scenario_id**: `closure-plugin-distribution.worktree-reuse`
- **WHEN** a user opens another worktree of a repository that already adopts the closure adapter contract
- **THEN** the installed closure bundle SHALL remain usable in that worktree without re-installing repo-local companion scripts

#### Scenario: New projects adopt closure through thin adapter files only

- **scenario_id**: `closure-plugin-distribution.new-project-thin-adapter`
- **WHEN** a new OpenSpec + superpowers project wants to adopt closure checks
- **THEN** the project SHALL only need thin adapter files such as `.openspec-closure.yaml` and change-local verification artifacts
- **AND** it SHALL NOT need to vendor the checker implementation itself


# closure-tooling-ownership Specification

## Purpose

TBD - created by archiving change openspec-closure-repo-extraction. Update Purpose after archive.

## Requirements

### Requirement: Closure tooling source-of-truth SHALL live in a sibling repository

Generic closure tooling SHALL have a single authoritative repository outside the OpenClaw product repo.

#### Scenario: Generic closure implementation migrates out of OpenClaw

- **scenario_id**: `closure-tooling-ownership.external-source-of-truth`
- **WHEN** `openspec-closure` is treated as cross-project tooling rather than OpenClaw product code
- **THEN** the runtime-neutral core, repo CLI / launchers, Codex bundle, Claude bundle, generic tests, and generic docs SHALL live in a dedicated sibling repository
- **AND** OpenClaw SHALL NOT keep an active duplicate of those implementation files as its repo-owned source-of-truth

#### Scenario: Generic closure capabilities stop living in OpenClaw main specs

- **scenario_id**: `closure-tooling-ownership.remove-generic-main-specs`
- **WHEN** the sibling repository becomes authoritative for closure tooling
- **THEN** OpenClaw SHALL remove generic closure tooling capabilities from `openspec/specs/`
- **AND** the authoritative specs for those capabilities SHALL exist in the sibling repository

#### Scenario: Generic closure development history moves with the tooling source

- **scenario_id**: `closure-tooling-ownership.move-active-generic-change`
- **WHEN** OpenClaw still contains an active generic closure tooling change such as `openspec-closure-companion`
- **THEN** that active generic change and its working plan artifacts SHALL move to the sibling repository
- **AND** OpenClaw SHALL NOT continue carrying it as an active product-repo change

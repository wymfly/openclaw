## ADDED Requirements

### Requirement: Fork additions to upstream schemas live in sibling files

For every upstream `src/gateway/protocol/schema/<name>.ts` file that the fork extends with appended TypeBox exports, those exports SHALL live in a sibling `src/gateway/protocol/schema/<name>-extensions.ts` file. The upstream file SHALL contain only upstream-authored content as inherited from the active rebase base.

#### Scenario: sessions schema split into base and extension files

- **WHEN** the codebase is built after this change
- **THEN** `src/gateway/protocol/schema/sessions.ts` SHALL contain only upstream-authored TypeBox schema exports as present at the rebase base, and `src/gateway/protocol/schema/sessions-extensions.ts` SHALL contain every fork-added TypeBox export currently appended to `sessions.ts`

#### Scenario: All ten extended schema files have siblings

- **WHEN** `find src/gateway/protocol/schema -name '*-extensions.ts'` is enumerated after this change
- **THEN** the result MUST include `sessions-extensions.ts`, `nodes-extensions.ts`, `protocol-schemas-extensions.ts`, `agents-models-skills-extensions.ts`, `devices-extensions.ts`, `cron-extensions.ts`, `logs-chat-extensions.ts`, `config-extensions.ts`, `exec-approvals-extensions.ts`, and a sibling for any extension content currently appended to `protocol/index.ts`

### Requirement: Barrel re-exports preserve consumer import paths

Extension schemas SHALL be exported through the existing `src/gateway/protocol/schema.ts` single-file barrel (note: there is **no** `protocol/schema/index.ts` in this codebase). The barrel SHALL re-export every symbol from each `*-extensions.ts` sibling such that consumers importing from the barrel resolve all symbols unchanged. Any source file that currently imports directly from `src/gateway/protocol/schema/<name>.ts` (e.g., `src/gateway/protocol/index.ts:528-554` directly imports `./schema/deck.js`) MUST either keep a per-file compatibility re-export from `<name>.ts` to `<name>-extensions.ts`, or be migrated to import through the barrel within the same phase.

#### Scenario: Consumer importing from the barrel sees both base and extension exports

- **WHEN** a handler imports `import { SessionsUsageResultSchema, SessionCompactionCheckpointReasonSchema } from "../../protocol/schema.js"`
- **THEN** before the change both symbols resolve from `sessions.ts` (re-exported by the barrel); after the change `SessionCompactionCheckpointReasonSchema` resolves from `sessions.ts` and `SessionsUsageResultSchema` resolves from `sessions-extensions.ts`, with both reachable via the barrel

#### Scenario: Direct importer from `protocol/schema/<name>.js` continues to resolve

- **WHEN** an existing consumer imports `import { SessionsUsageResultSchema } from "../../protocol/schema/sessions.js"` (a direct import of the upstream file)
- **THEN** the consumer MUST continue to resolve the symbol by one of: (a) `sessions.ts` re-exporting from `sessions-extensions.ts` for backward compatibility, or (b) the consumer being migrated within the same phase to import from `protocol/schema.ts` or `protocol/schema/sessions-extensions.ts` directly

#### Scenario: Existing direct import of fork-only deck schema is preserved

- **WHEN** `src/gateway/protocol/index.ts:528-554` imports deck schema directly from `./schema/deck.js`
- **THEN** the import MUST continue to resolve unchanged, because `./schema/deck.js` is a fork-only file (not subject to sibling-split) and is therefore unaffected by this refactor

### Requirement: Sibling-extension pattern is restricted to additive content

The sibling pattern SHALL be applied only to fork-added TypeBox exports that are net-new (i.e., do not modify the meaning, signature, or constraints of any upstream-authored export). Modifications of existing upstream exports MUST remain in the upstream file and MUST be tracked separately.

#### Scenario: A net-new TypeBox export qualifies for sibling

- **WHEN** the fork adds a new `SessionsUsageResultSchema` that did not exist upstream
- **THEN** the export MUST move to `sessions-extensions.ts`

#### Scenario: A modification to an upstream export does not qualify

- **WHEN** the fork modifies an upstream-authored export's shape (e.g., adds a property to `SessionPatchParamsSchema`)
- **THEN** the modification MUST stay in the upstream file `sessions.ts`, MUST be flagged in the rebase risk inventory, and MUST be re-evaluated for an upstream PR

### Requirement: Codegen consumes schemas through the barrel

The codegen pipeline (`scripts/protocol-gen-ts.ts`) SHALL consume schemas through the `src/gateway/protocol/schema.ts` barrel (or through `src/gateway/protocol/index.ts` for symbols re-exported there) rather than reading individual schema files directly. Where pre-existing direct file reads are present, they SHALL be tracked and either replaced with barrel reads or kept with documented justification, so that the introduction of `*-extensions.ts` siblings is transparent to codegen.

#### Scenario: Codegen output before/after split is byte-identical

- **WHEN** `pnpm protocol:gen:ts` is executed before this change and after this change with no other modification
- **THEN** the resulting `dashboard/src/types/gateway-protocol.generated.ts` and `dashboard/src/types/gateway-client.generated.ts` files MUST be byte-identical

### Requirement: Rebase audit measures upstream-file edit footprint

A scripted audit SHALL measure the per-file fork edit footprint on `src/gateway/protocol/schema/*.ts` after this change and SHALL report a passing result when no upstream schema file has more than 5 modified or added lines (excluding `index.ts`'s re-export lines).

#### Scenario: Audit script runs in CI and enforces footprint cap

- **WHEN** `node scripts/audit-schema-fork-footprint.ts` is executed against the post-refactor branch
- **THEN** every upstream `src/gateway/protocol/schema/<name>.ts` file (excluding fork-only `*-extensions.ts` siblings) MUST have ≤ 5 fork-added or fork-modified lines vs. the rebase base. The single-file barrel `src/gateway/protocol/schema.ts` is permitted to add up to one `export * from "./<name>-extensions.js"` line per affected sibling
- **AND** if any file exceeds this cap, the script MUST exit non-zero and identify the offending file

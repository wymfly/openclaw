## ADDED Requirements

### Requirement: Models typed config writes SHALL declare write-safety semantics

Every typed Models config mutation SHALL participate in deck-go config-write safety governance.

#### Scenario: Models write metadata is generated

- **WHEN** a typed Models mutation is added to contract sources
- **THEN** the write-safety metadata SHALL name route/action, owner module, Gateway support basis, base-hash requirement, next-hash behavior, conflict behavior, idempotency status, audit/rollback status, and verification evidence.

#### Scenario: Models write forwards base hash

- **WHEN** a provider/model/mode mutation writes through Gateway `config.patch`
- **THEN** the frontend and BFF SHALL pass the current expected base hash or block the mutation with a typed error before sending an unsafe write.

#### Scenario: Models write conflict is normalized

- **WHEN** Gateway or the deck-go BFF detects stale preview data, stale base hash, or a config conflict
- **THEN** the response SHALL preserve original upstream details where available and expose a stable product state that the frontend can render without losing operator edits.

#### Scenario: Models write lacks audit or rollback

- **WHEN** the code path lacks durable audit, rollback, version restore, or idempotency support
- **THEN** the contract and UI SHALL mark those capabilities unsupported or deferred
- **AND** tests SHALL ensure no product copy claims them as available.

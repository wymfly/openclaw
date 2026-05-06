## 1. Contract Source And Generation

- [x] 1.1 Add a Deck-owned live projection source contract that maps panel projections to streams, events, refresh endpoints, stale thresholds, cursor persistence, and gap policies.
- [x] 1.2 Add a sync/check generator that validates referenced streams/events/endpoints and writes Markdown docs plus frontend TypeScript metadata.
- [x] 1.3 Wire live projection contract sync/check targets into the deck-go Makefile and contract gate.

## 2. Frontend Subscription Semantics

- [x] 2.1 Add shared frontend live projection subscription utilities backed by the generated contract metadata.
- [x] 2.2 Refactor current non-chat live stream consumers to use the shared helper without changing panel UI behavior.
- [x] 2.3 Preserve chat's specialized dispatcher while documenting/typing its contract metadata linkage.

## 3. Verification And Matrix Closure

- [x] 3.1 Add focused tests for generated contract validation and frontend shared subscription behavior.
- [x] 3.2 Run focused frontend/backend/contract verification, including stream smoke evidence for reconnect and projection-gap behavior.
- [x] 3.3 Update the contract-chain audit matrix item and head proposal evidence for this child.
- [x] 3.4 Validate, archive the OpenSpec change, and ensure the archived spec is valid.

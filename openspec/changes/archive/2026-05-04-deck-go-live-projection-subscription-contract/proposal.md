## Why

Deck Go already exposes BFF SSE streams and several panels consume them, but the product-level rules for subscription, refresh, stale-state, and projection-gap recovery are scattered across panel code. This makes future control modules drift from the Gateway-derived contract chain even when the underlying Gateway stream support is available.

## What Changes

- Add a Deck-facing live projection subscription contract that names the live surfaces, source stream endpoints, events, refresh endpoints, stale-state rules, and projection-gap behavior.
- Generate human-readable documentation and a frontend-readable TypeScript contract artifact from the source contract.
- Refactor current frontend stream consumers to use shared subscription helpers for status, Last-Event-ID persistence, stale marking, pause/resume, and gap recovery.
- Keep the current Gateway/BFF transport unchanged: `/api/stream`, `/api/logs/stream`, and `POST /api/chat/session-events` remain the supported source APIs.
- Update the contract-chain audit matrix to mark this child proposal archived only after verification and archive.

## Capabilities

### New Capabilities

- `deck-go-live-projection-subscription-contract`: Product-level contract for Deck Go live projection subscriptions, refresh, stale-state, and projection-gap recovery.

### Modified Capabilities

- None.

## Impact

- Affected contracts: `deck-go/contracts/source/deck-streams.contract.json` or a sibling live-projection contract source, generated docs, and generated frontend metadata.
- Affected frontend: shared stream/subscription helper code plus current live consumers in chat, agents, activity, approvals, settings, command discovery, and logs.
- Affected tests: focused contract generation checks, frontend unit tests for shared subscription behavior, and focused browser/API smoke for SSE reconnect and gap semantics.
- No new external dependencies and no new upstream Gateway API requirements.

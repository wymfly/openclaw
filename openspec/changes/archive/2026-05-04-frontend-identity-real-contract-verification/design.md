## Context

`deck-go/frontend-handoff/modules/identity/` contains a revised v2 prototype for a canonical-to-channel-peer registry. The current production `frontend-new` identity panel already uses the core BFF wrappers (`fetchIdentityLinks`, `linkIdentityPeer`, `unlinkIdentityPeer`) and baseHash optimistic concurrency, but it remains a compact earlier implementation and does not expose the full v2 product model.

Verified current contract facts:

- Browser code must call only deck-go backend routes.
- Deck-facing DTO authority currently exposes `DeckGoIdentityPeer`, `DeckGoIdentityLink`, `DeckGoIdentityLinksResponse`, and `DeckGoAgentIdentityResponse`.
- The BFF routes are `GET /api/deck/identity`, `POST /api/deck/identity`, and `GET /api/agents/{agentId}/identity`.
- Upstream typed Gateway methods currently include `deck.identity.list`, `deck.identity.link`, `deck.identity.unlink`, and `agent.identity.get`.
- Rename/create/delete canonical are prototype assumptions and are not currently in the generated Gateway allowlist or BFF action switch.
- Peer activity enrichment and recent mutation history are prototype/product projections, not current identity DTO fields.

## Goals / Non-Goals

**Goals:**

- Implement the identity v2 registry workbench where supported by the current contract chain.
- Preserve baseHash optimistic concurrency for link/unlink mutations and make conflict/missing-hash states explicit.
- Keep unsupported prototype mutations disabled or documented rather than synthesizing risky multi-step behavior.
- Update contract metadata, handoff notes, mock fixtures, focused frontend/backend tests, L1 mock visual E2E, and bounded L2 real-stack E2E.
- Record a workflow-to-contract matrix and archive-ready evidence before moving to the next module.

**Non-Goals:**

- Add unsupported upstream methods for rename/create/delete unless implementation discovers already-supported Gateway/BFF truth.
- Add profile, API key, active session, proofing, directory sync, trust scoring, or durable audit-log features to identity.
- Add new frontend dependencies or promote identity-local channel icons/molecules to shared design-system atoms in this pass.
- Force real external channel or LLM activity solely to create identity audit data.

## Decisions

- **Use v2 as product target and contract truth as authority.** The production UI should move toward the two-pane canonical registry, but only the list/link/unlink/agent profile parts are guaranteed active behavior today.
- **Keep mutations narrow and real.** Link/unlink use the existing `POST /api/deck/identity` action envelope and current `configHash` as `baseHash`. Rename/create/delete stay disabled or documented until a matching Gateway/BFF contract exists.
- **Do not fabricate peer activity.** Last seen, actor, and recent mutation rows may appear as empty/projection placeholders, but the UI must not claim them as wire-contract data without DTO support.
- **Real-stack verification is bounded.** L2 can verify route shape, list response, BFF-only browser access, and safe link/unlink only when the real Gateway has a usable identity config/hash. If the real stack lacks state or returns unsupported/empty data, record degraded or handoff-blocked evidence after bounded attempts.

## Risks / Trade-offs

- **Real Gateway identity state may be empty or lack `configHash`** -> Treat list shape as valid evidence and skip-safe/handoff-block link/unlink attempts when mutation would be unsafe.
- **Prototype overstates mutation capability** -> Keep rename/create/delete inactive and record the contract gap instead of adding synthetic relink/delete workflows.
- **Identity link/unlink can affect operator configuration** -> L2 mutation attempts must use controlled test values and only proceed when baseHash is present; otherwise use mock/local evidence and record the real blocker.
- **Future contracts may add richer activity fields** -> Keep current UI normalization tolerant of extra peer fields without requiring them.

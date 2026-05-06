## Context

`config` has a recent v2 handoff package and an existing production panel with raw config loading/apply and schema lookup behavior. It is higher-risk than read-only modules because it can write `openclaw.json` through Gateway config methods. The browser boundary remains unchanged: frontend code calls the Go BFF only.

The verified route chain is:

- `GET /api/config` -> Go `/config` -> Gateway `config.get`
- `POST /api/config/apply` -> Go `/config/apply` -> Gateway `config.apply`
- `POST /api/config/schema-lookup` -> Go `/config/schema-lookup` -> Gateway `config.schema.lookup`
- `POST /api/config/patch` remains available for other Deck workflows but is not the primary v2 raw editor apply path

## Goals / Non-Goals

**Goals:**

- Verify the full Config contract chain from Gateway methods to Go BFF routes, generated DTOs, frontend wrappers, production edit/apply behavior, mock fixtures, and real-stack shape.
- Translate the v2 handoff into the production panel while keeping writes gated by `baseHash` and raw JSON validation.
- Fix clear Config-scoped drift directly, especially method/route naming in handoff docs and production UI behavior that contradicts the verified contract.
- Capture L1 mock visual evidence and bounded L2 real-stack evidence without unsafe production-style config mutation.

**Non-Goals:**

- Add a form library dependency or a new shared schema-form abstraction.
- Add Gateway/BFF endpoints for apply history, rollback, import/export, schema lookup batching, or default config scaffold.
- Treat prototype `recentApplies` as durable contract truth.
- Change global OpenClaw security policy or real user config values outside a safe/noop test path.

## Decisions

- **Use raw apply as the write authority.** Production applies the full raw JSON through `applyDeckConfig(raw, baseHash)` after validating that the draft parses to an object and after showing a diff/confirmation state.
- **Use schema lookup lazily and cache locally.** Production may load root and selected section paths, cache lookup responses by path, and invalidate cache after successful apply. Batch lookup stays a follow-up.
- **Separate visual history from contract history.** The right-pane history can show local session actions or mock projection, but it must not claim a durable apply audit endpoint exists.
- **Bound L2 write risk.** Real-stack verification first proves read shape, schema lookup, and UI rendering. If exercising apply, use a noop apply of the fetched raw with current `baseHash`; if even noop apply is risky or blocked, record handoff-blocked evidence and continue after static/L1 proof.
- **Fix deterministic drift directly.** Route/method docs, wrappers, mock data, parsing, form/raw state, conflict handling, and tests are in scope when code truth is clear.

## Risks / Trade-offs

- **Config writes can restart or mutate real Gateway state** -> Prefer read-only and noop apply in L2; record any non-noop mutation requirement as follow-up.
- **Schema lookup may return dynamic or partial hints** -> UI renders missing fields as unavailable and keeps raw payload visible.
- **Prototype expects apply history without a contract** -> Keep it local/mock or mark unsupported rather than fabricating persisted audit.
- **Form surface can become too broad** -> Implement a focused schema-guided editor around the current DTOs, not a generic form platform.

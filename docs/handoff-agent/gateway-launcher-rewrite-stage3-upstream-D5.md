# Gateway Launcher Rewrite Stage 3 Upstream D5 Handoff

**OpenSpec change**: `openspec/changes/gateway-launcher-rewrite/`
**Plan**: `deck-go/docs/superpowers/plans/2026-05-14-gateway-launcher-rewrite-stage3.md`
**Scope**: Owner-visible handoff for task 2.3.2, the upstream Gateway static asset route.
**当前状态**: handoff-blocked — deck-go is insulated by the BFF reverse proxy; upstream route still needs owner sign-off or a separate PR.

## Round 1: 补充 (supplement) by codex on 2026-05-14

Stage 3 completed the deck-go-side path by keeping browser traffic on the BFF
origin and removing the legacy `/api/canvas/*` direct Gateway proxy from
`deck-go/backend/internal/server/assets.go`.

Current deck-go browser asset path:

- Frontend canvas code uses `/api/runtime/gateway-assets/...`.
- `deck-go/backend/internal/server/gateway_assets_proxy.go` forwards those
  requests to the Gateway with the Gateway token injected inside the BFF.
- Browser code does not need a direct Gateway URL or Gateway token.

Remaining upstream gap:

- `openspec/changes/gateway-launcher-rewrite/tasks.md` task 2.3.2 asks for a
  Gateway-side static HTTP route in `src/gateway/server/`.
- This is not a deck-go-local code change and should be handled as a separate
  upstream Gateway PR or explicitly accepted as deferred by the owner.

Tradeoff record for the future Gateway PR:

- Motivation: let deck-go fetch A2UI/canvas assets through an official Gateway
  HTTP surface instead of a legacy ad hoc route.
- Alternative rejected for deck-go: browser-to-Gateway direct fetch, because it
  would violate the Browser -> deck-go BFF -> Gateway boundary and expose token
  handling to browser code.
- Lock-in: the new Gateway route should be additive and static-route scoped,
  not a new `deck.*` RPC. Rule R1 does not directly classify this HTTP route,
  but the PR should still record the same motivation/alternatives/lock-in
  discipline.

**当前 verdict**: approve-with-followup

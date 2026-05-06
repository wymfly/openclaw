## Why

Deck Go currently renders chat content through several partially aligned paths: OpenClaw Gateway transcript schemas, Go BFF projection, Deck-facing contracts, frontend `ContentBlock` renderers, artifact heuristics, and A2UI canvas state. The result is usable but not yet a strong contract chain: Gateway-supported non-audio/video content can be dropped, downgraded to raw JSON, or treated as a frontend-only enhancement instead of a product-level control surface.

This change converges the non-audio/video content surface so future frontend work can rely on a clear, code-backed contract from OpenClaw Gateway capabilities through deck-go backend and frontend product design.

## What Changes

- Align the Gateway transcript contract and canonicalizer with the non-audio/video content types Deck needs to control: text, thinking, tool use/result, image, file, canvas, and unknown fallback.
- Tighten Deck-facing DTOs and Go projection so canvas blocks, unknown blocks, structured tool results, and attachment semantics survive the Gateway → Go BFF → frontend chain without silent loss.
- Make artifacts an explicit Deck product surface derived from tool results and transcript blocks, with documented supported render kinds and clear boundaries from Gateway-owned content.
- Converge canvas/A2UI behavior across inline canvas, right drawer canvas, bridge commands, and projection persistence, while keeping audio/video out of scope.
- Reconcile file upload UX with OpenClaw’s actual model-input support: images are actionable model attachments; generic files must either render as visible local/transcript artifacts or be blocked/deferred with clear UI feedback until Gateway supports them as model inputs.
- Add strict implementation and verification requirements covering contract generation, Go backend tests, frontend mock visual tests, and bounded real Gateway E2E evidence.

## Capabilities

### New Capabilities

- `deck-go-content-surface-contract`: Defines the end-to-end non-audio/video content contract from OpenClaw Gateway transcript/media/canvas capability through Deck-facing DTOs, Go projection, frontend content blocks, artifact surfaces, canvas/A2UI state, and upload semantics.

### Modified Capabilities

- `transcript-rendering-contract`: Extends transcript rendering requirements beyond text/tool/image/file blocks to cover canvas, unknown fallback, structured artifact entry points, and consistency across chat/session views.

## Impact

- OpenClaw Gateway: `src/gateway/protocol/schema/transcript.ts`, `src/gateway/transcript-canonical.ts`, chat/session event tests, and canvas history augmentation tests.
- deck-go contracts: `deck-go/contracts/source/deck-api.contract.ts`, endpoint/UI metadata where needed, generated TS/Go contract artifacts, and contract governance checks.
- deck-go Go backend: chat/session projection, `/chat/history`, `/chat/snapshot`, `/chat/send`, `/chat/projection`, `/deck/canvas`, `/api/canvas/*`, and focused backend tests.
- deck-go frontend: `frontend-new` chat content types, transcript adapter, tool result/artifact/canvas renderers, upload composer, A2UI bridge state, i18n, and mock visual/E2E fixtures.
- Verification: `openspec validate`, contract gate, focused Gateway tests, focused Go backend tests, focused frontend tests, mock visual coverage, and bounded real Gateway E2E evidence with documented circuit breakers.

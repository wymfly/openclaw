## Context

Current code facts found during exploration:

- OpenClaw Gateway transcript schema currently exposes `text`, `thinking`, `tool_use`, `tool_result`, `image`, and `file` blocks in `src/gateway/protocol/schema/transcript.ts`; it does not expose `canvas` or a typed `unknown` fallback.
- Gateway history augmentation can produce canvas-shaped content from tool output (`src/chat/canvas-render.ts` and `augmentChatHistoryWithCanvasBlocks` in `src/gateway/server-methods/chat.ts`), but `src/gateway/transcript-canonical.ts` can still drop unrecognized blocks because it returns `null` for unknown content.
- Gateway image attachments are real model inputs. Generic non-image files are not currently accepted as model inputs by `parseMessageWithAttachments`; they are dropped after MIME sniffing. This proposal must reflect that product truth instead of pretending all files are model attachments.
- Deck-facing `DeckGoTranscriptBlock` already has eight frontend-oriented variants in `deck-go/contracts/source/deck-api.contract.ts`: `text`, `image`, `file`, `tool_use`, `tool_result`, `thinking`, `canvas`, and `unknown`.
- The generated Gateway protocol artifact still has only six transcript variants, so the Gateway-facing chain and Deck-facing chain disagree.
- Go projection normalizes transcript blocks in `deck-go/backend/internal/runtime/projection/sessions.go`, but the generated Gateway `TranscriptBlock` is `any`, so projection is responsible for preserving product semantics.
- `POST /chat/projection` currently validates only `sessionKey` and returns `{ok:true}`. Frontend callers already attempt to persist `a2uiState`, so the product contract exists at the browser layer but not at the BFF layer.
- The frontend artifact panel is a useful product surface, but it is currently a heuristic derived from `tool_result` strings (`detectArtifact.ts`) rather than a documented contract.
- The frontend canvas stack has two surfaces: inline `canvas` transcript blocks and the right-side A2UI drawer. Both are real product surfaces, but their data model is not yet described as a single contract.

The target architecture for non-audio/video content is:

```text
OpenClaw Gateway source truth
  transcript schema + canonicalizer + chat/session events + canvas host
        |
        v
deck-go generated Gateway client
  generated TS/Go protocol artifacts
        |
        v
Go BFF projection and product adaptation
  /chat/history, /chat/snapshot, /chat/send, /chat/projection, /deck/canvas
        |
        v
Deck-facing contract source
  deck-api.contract.ts + endpoint/UI metadata + generated TS/Go DTOs
        |
        v
frontend-new product surfaces
  transcript renderers, tool result views, artifact panel, inline canvas, A2UI drawer
```

## Goals / Non-Goals

**Goals:**

- Make the non-audio/video content chain explicit and testable from Gateway source through Deck UI.
- Align Gateway transcript schema/canonicalization with the Deck content variants that are backed by current OpenClaw capability.
- Preserve canvas blocks and unknown blocks across history, SSE, Go projection, frontend normalization, and rendering.
- Define artifacts as a Deck product view over transcript/tool result content, including supported render kinds, raw fallback, and source identity.
- Make attachment UX honest: images are supported model attachments; generic files are not silently sent as model inputs unless Gateway support exists.
- Implement `/chat/projection` enough that A2UI/canvas projection round-trips through `/chat/snapshot`.
- Add mock and real verification with a circuit breaker for environment-dependent real Gateway checks.

**Non-Goals:**

- No audio or video transcript renderer, upload support, or contract variant in this change.
- No new external dependency.
- No GraphQL/gRPC replacement or direct browser-to-Gateway calls.
- No broad visual redesign of chat, artifacts, or canvas beyond changes required for contract/product correctness.
- No generic Gateway file-upload feature beyond what OpenClaw currently supports.
- No attempt to make arbitrary upstream `className` or `style` fields authoritative in Deck UI; Deck controls styling through its design system.

## Decisions

### D1: Gateway source contract gets `canvas` and `unknown`, not a separate Deck-only fork

**Decision:** Extend Gateway transcript schema and canonicalization to preserve non-audio/video `canvas` blocks and explicit `unknown` fallback blocks. Keep audio/video outside the known variant set for this proposal.

**Rationale:** Deck can only be robust if Gateway history and events preserve the content shape. Deck-facing DTOs already know `canvas` and `unknown`; the Gateway-facing generated protocol is the weak link.

**Alternative rejected:** Keep Gateway schema at six variants and patch only frontend normalizers. That leaves Go projection and generated client truth inconsistent and makes future UI design rely on defensive heuristics.

### D2: Deck-facing canvas block is normalized to one product shape

**Decision:** Deck-facing canvas blocks SHALL use a direct shape:

```ts
{
  type: "canvas";
  kind: "canvas";
  surface: "assistant_message";
  render: "url";
  url: string;
  viewId?: string;
  title?: string;
  preferredHeight?: number;
}
```

Go and frontend normalizers may accept upstream preview-wrapped inputs (`{ type: "canvas", preview: {...} }`) but they must emit the direct Deck shape. Arbitrary `className` and `style` are not part of the Deck-facing canvas contract.

**Rationale:** The direct shape is easy for frontend rendering and design metadata. Accepting preview-wrapped inputs preserves compatibility with existing Gateway augmentation.

**Alternative rejected:** Expose the full upstream preview shape including presentation style fields. That would let runtime output steer Deck styling and weaken design-system control.

### D3: Artifacts are a product view, not a Gateway transcript block

**Decision:** Do not add `artifact` as a Gateway transcript block in this change. Define artifact detection and rendering as a Deck product view derived from `tool_result` content, `file`/`image` blocks, and tool context. Supported artifact render kinds are `html`, `svg`, `mermaid`, `json`, `csv`, `markdown`, `code`, `text`, and `image`.

**Rationale:** OpenClaw currently emits tool results and files, not a stable artifact entity. Deck should provide a richer control UI without inventing a false upstream contract.

**Implementation implication:** Artifact identity must be deterministic enough for UI tests and state retention, for example derived from `sessionKey`, `messageId`, `toolUseId`, content kind, and index rather than a process-global increment.

**Alternative rejected:** Make artifact a first-class backend-persisted entity immediately. That would create more storage and lifecycle questions than the current Gateway capability justifies.

### D4: Attachment product contract follows OpenClaw model-input reality

**Decision:** Deck upload UX SHALL distinguish:

- image attachments: can be sent through `chat.send`/`sessions.send` as model attachments when the selected model supports images;
- generic files: must not be silently sent as model attachments. The UI must either block with clear feedback, or stage them only as visible product artifacts if a deterministic file-artifact path is implemented.

**Rationale:** Gateway `parseMessageWithAttachments` currently parses image attachments and drops non-image MIME types. Product UX must not imply unsupported files are reaching the model.

**Alternative rejected:** Keep accepting any file and rely on Gateway warnings. Users cannot see Gateway warnings in the UI, so this produces false confidence.

### D5: `/chat/projection` becomes the BFF persistence point for Deck-only view state

**Decision:** Implement `/chat/projection` as a real Deck BFF endpoint for Deck-owned session projection, starting with sanitized A2UI/canvas state. `/chat/snapshot` must merge this projection back into the session detail response.

**Rationale:** Canvas drawer visibility, bridge replay events, and surface metadata are product state; they are not pure Gateway transcript state. They need an explicit Deck-owned projection point so refreshes and snapshots are coherent.

**Storage rule:** The first implementation must at least pass a backend round-trip test in the same Go process. If durable storage is available through existing deck-go state infrastructure without broad refactor, use it; otherwise document process-local durability as a follow-up risk.

### D6: Verification is layered and bounded

**Decision:** Completion requires four evidence layers:

1. Source/generator evidence: protocol and Deck contracts regenerate cleanly.
2. Gateway/backend evidence: focused tests prove canonicalization, projection, and route behavior.
3. Frontend mock evidence: unit/component tests plus mock visual scenarios prove rendering and UX.
4. Real Gateway evidence: one bounded real-stack smoke for image attachment, tool artifact, canvas, and unknown fallback where possible.

Real Gateway checks may circuit-break after 2 failed environment attempts if failures are infrastructure-related; code-level tests remain mandatory.

## Risks / Trade-offs

- **Gateway schema changes touch generated artifacts** -> Keep additions additive and run `make protocol-check` / `make contract-gate`.
- **Canvas preview compatibility is easy to break** -> Add tests for both direct canvas and preview-wrapped canvas at Gateway, Go projection, and frontend adapter layers.
- **Artifact detection can over-detect ordinary text** -> Require deterministic thresholds, source metadata, and raw fallback; avoid auto-opening artifacts.
- **Generic file upload may feel like a regression** -> Make UI copy explicit: images are model attachments; other files are currently not model inputs. A later proposal can add real file ingestion when Gateway supports it.
- **Projection persistence scope may be contentious** -> The spec requires round-trip correctness; durable persistence can be staged if current state infrastructure makes it too invasive.
- **Real E2E depends on local Gateway/model state** -> Use bounded attempts and record handoff blockers, but do not mark code tasks complete without mock and unit evidence.

## Migration Plan

1. Update Gateway transcript schema/canonicalizer and tests for `canvas` and `unknown`.
2. Regenerate Gateway protocol artifacts and fix Deck Go generated consumers.
3. Update Deck-facing contract source for attachment and projection DTOs, artifact view metadata if needed, then regenerate Deck DTOs.
4. Update Go BFF projection and route handling for canvas, unknown, structured tool results, image-only attachment validation, and `/chat/projection` round-trip.
5. Update frontend adapter/renderers/upload UX/artifact identity/canvas state handling.
6. Add mock visual fixtures for text, thinking, tool use/result, image, file, canvas, unknown, artifact kinds, and unsupported generic file upload.
7. Run layered verification and record real Gateway evidence or a circuit-break handoff.

Rollback is a single-change revert before archive. Since changes are additive to Gateway schema and product-contract constrained, rollback should restore the previous six-variant Gateway generated protocol and current Deck UI behavior.

## Open Questions

No user decision is currently required to create an implementable proposal. The implementation may record a follow-up if durable projection storage would require a broader state-store refactor than the process-local round-trip required here.

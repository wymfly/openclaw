# Models Config Control Plane Repair Plan

> **For agentic workers:** Execute this as a narrow repair plan for the active OpenSpec change `deck-go-models-config-control-plane`. It does not add new product scope; it turns existing OpenSpec source-truth requirements into concrete validation gates.

**Goal:** Repair the typed Models control plane so every product mutation emits OpenClaw-compatible `models` config shapes, then complete mock/real E2E evidence and archive the change.

**Architecture:** Keep the deck-go product DTO layer, but bind it explicitly to OpenClaw source truth. Product inputs may remain ergonomic, but BFF persistence must emit OpenClaw `ModelProviderConfig` / `ModelDefinitionConfig` shapes accepted by Gateway `config.patch`.

**Tech Stack:** OpenSpec, deck-go Go BFF, deck-go contracts/codegen, React frontend-new, Playwright E2E, OpenClaw TypeScript zod config schema.

---

## Source Truth Binding

Authoritative source files:

- `src/config/types.models.ts`
- `src/config/zod-schema.core.ts`
- `src/config/types.secrets.ts`
- Gateway `config.get` / `config.patch` behavior

Required persisted/API shapes:

- `models.providers.<provider>.models` persists as `ModelDefinitionConfig[]`, not a map.
- `apiKey` and provider `headers.*` persist as OpenClaw `SecretInput`: literal string or `{ source, provider, id }`. Normal deck-go UI writes must emit `{ source, provider, id }`, not `{ ref, refTemplate }`.
- Model `input` persists only `"text"` and `"image"` until OpenClaw schema adds more modalities.
- Optional booleans such as `authHeader`, `injectNumCtxForOpenAICompat`, and `reasoning` must support explicit disable/delete, not only enable.

## Tasks

### Task 1: Contract and Generated DTO Repair

- [ ] Update `deck-go/contracts/source/deck-api.contract.ts` so typed Models DTOs expose source-truth-bound secret refs, text/image-only input modalities, and explicit boolean toggle actions.
- [ ] Run `cd deck-go && make contracts-sync`.
- [ ] Verify generated TS/Go DTOs reflect the source contract.

### Task 2: BFF Persistence Shape Repair

- [ ] Update `deck-go/backend/internal/server/models_control_helpers.go` so projections accept legacy map and source-truth array shapes, but all typed writes persist source-truth arrays.
- [ ] Convert product secret-ref actions into `{ source, provider, id }` before persistence.
- [ ] Add explicit boolean action handling for provider and model toggles.
- [ ] Add mutex protection to `modelsControlImpactStore`.

### Task 3: Source-Truth Tests

- [ ] Convert backend fixtures in `deck-go/backend/internal/server/models_control_test.go` to source-truth provider/model/secret shapes.
- [ ] Add tests that fail on map-shaped persisted models, `{ ref, refTemplate }` secret persistence, unsupported modalities, and missing model arrays on provider create.
- [ ] Add race-safe/concurrency coverage for impact preview token storage.

### Task 4: Frontend Product DTO Alignment

- [ ] Update `frontend-new/src/components/panels/models` to use generated source-truth DTOs: SecretRef fields, boolean toggle actions, text/image-only modalities.
- [ ] Update focused component/data tests and i18n copy where necessary.

### Task 5: E2E and Closure

- [ ] Add or retarget typed mock E2E for Models product UI.
- [ ] Add or retarget bounded real Gateway smoke for typed provider/model create/read/delete cleanup.
- [ ] Run OpenSpec strict validation, contract gate, focused backend/frontend checks, mock E2E, real E2E or bounded handoff.
- [ ] Update `tasks.md` and `verification.yaml`, sync accepted specs, archive the OpenSpec change.

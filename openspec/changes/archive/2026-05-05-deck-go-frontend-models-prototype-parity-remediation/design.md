## Context

The active Models handoff is a multi-file React prototype with a list-to-detail
workflow. The current production panel already uses the correct BFF/Gateway
wrappers:

- `fetchModelsConfig` / `saveModelsConfig` for raw config authority;
- `fetchRuntimeConfiguredModels` for `models.configured`;
- `fetchRuntimeModelAuthOverview` for `deck.auth.overview`;
- `fetchRuntimeModelCatalogProviders` for `models.catalog.providers`;
- `probeRuntimeModelAuth` for `deck.auth.probe`;
- `fetchModelUsageCost` and `fetchModelUsageProviders` for usage projections.

The implementation gap is product shape and evidence strictness. Existing tests
verify a broad configuration workbench, but the active handoff expects operators
to begin from a model inventory, select a model, inspect model-specific tabs,
and open catalog/auth/probe dialogs.

## Decisions

### D1: Preserve the contract chain and change the product shell

The current wrappers and BFF endpoints are contract truth. This change should
not invent new Gateway endpoints to match the prototype. Instead, production UI
will project the existing DTOs into the prototype product flow and mark
unsupported projected fields as unavailable or explicitly projected.

### D2: Keep raw config as advanced authority

`PATCH /models/config` remains the save authority for provider config, fallback
chains, allowlists, and catalog apply. The raw textarea should not be removed,
but it should be treated as an advanced/detail surface so the first viewport
matches the product design.

### D3: Real E2E must create representative Models data when safe

Models data is safely fixtureable in the isolated real E2E state because
`openclaw.json` is copied into a temporary state directory. The real test should
fetch `/models/config`, patch a run-scoped provider/model entry, assert cleanup
targets contain the run id, verify the UI sees the run-scoped model, then patch
the config back to remove only run-scoped data. If PATCH is unavailable or
degraded, the test may circuit-break with evidence.

### D4: Handoff projections stay labelled

Pricing snapshots and PATCH audit history are handoff-level projections, not
current guaranteed DTOs. The UI can show contract-derived cost fields when
available, but it must not claim a real pricing/audit backend exists unless the
Deck-facing contract provides it.

## Risks

- **Config mutation risk:** mitigated by isolated real E2E state and run-id
  cleanup guards.
- **Large UI rewrite:** scoped to `frontend-new/src/components/panels/models/`
  and verified with unit, mock visual, parity report, and real E2E.
- **Prototype overreach:** unsupported projections become accepted exceptions or
  unavailable states rather than new backend assumptions.
- **Real RPC degradation:** `models.configured`, auth overview, or catalog may
  degrade on a local real stack; fixture creation through `/models/config` and UI
  assertions stay strict when the route is available, while runtime RPC
  degradation is recorded separately.

## Implementation Plan

1. Audit current Models prototype and production UI against contract truth.
2. Implement list/detail/dialog structure over existing DTOs.
3. Update tests and mocks for mock parity states.
4. Add real E2E fixture creation/cleanup through `/models/config` and product UI
   variants.
5. Generate prototype-vs-current parity evidence and record verdict.
6. Validate, update matrix/notes/head task, and archive the child change.

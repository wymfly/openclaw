## Context

Config is the `openclaw.json` control surface. Its contract chain is already
established:

`ConfigPanel` -> `frontend-new/src/api.ts` wrappers -> Deck BFF routes:

- `GET /api/config`
- `POST /api/config/apply`
- `POST /api/config/schema-lookup`

Those routes adapt Gateway `config.get`, `config.apply`, and
`config.schema.lookup`. The active prototype in
`frontend-handoff/modules/config/prototype.html` is a three-pane workbench:
section navigation, structured schema-driven form, and a right preview pane for
Diff / Raw / History. The current implementation already follows much of that
shape, but the remediation head still records Config as "mock functional green;
parity unreviewed." This child change must produce the missing parity evidence
and fix deterministic mismatches instead of treating the older real-contract
pass as final proof.

## Goals / Non-Goals

**Goals:**

- Confirm `frontend-handoff/modules/config/prototype.html` is the active visual
  target and `prototype-v1-codex.html` is reference-only.
- Audit production Config against the active v2 three-pane editor prototype.
- Fix deterministic drift in layout, pane modes, dialogs, localized text, mock
  fixtures, route wrappers, or read/write guards when contract truth supports
  the prototype.
- Preserve BFF-only browser access for all Config reads, lookups, and writes.
- Preserve safe write behavior: raw/structured apply is active only when the
  Gateway/BFF returns writable raw text and an optimistic concurrency hash.
- Attempt representative real fixture data by reading isolated real config and
  performing only bounded no-op or run-scoped reversible writes when the real
  response exposes writable raw text.
- Upgrade mock visual E2E and real Gateway E2E to the strengthened head
  standard, including shell navigation, both theme/locale axes, safe child
  surfaces, fixture evidence, and unexpected-error checks.
- Update Config implementation notes, matrix row, and head task `5.7`.

**Non-Goals:**

- Do not add a durable config apply history endpoint in this child.
- Do not add scaffold/create-defaults, import/export, rollback/version restore,
  schema batch lookup, or field-level validation contracts.
- Do not mutate a real user/global `openclaw.json` outside the isolated real E2E
  state.
- Do not force real writes when the Gateway returns `raw: null` or omits
  `baseHash`; record skipped-safe/handoff-blocked fixture evidence instead.
- Do not introduce a form library dependency in this child.
- Do not edit generated contract artifacts unless a source contract fix requires
  regeneration.

## Decisions

### D1: Treat current implementation as a candidate, not proof

Production Config already has the right BFF contract chain and many v2 workbench
concepts. This child should first generate prototype-current evidence and patch
only concrete deterministic gaps found by that comparison.

Alternative considered: rebuild Config directly from the handoff files.
Rejected because the existing implementation already encodes important safety
rules around `raw: null`, `baseHash`, conflict recovery, and BFF-only transport.

### D2: Real fixture attempts must be no-op or run-scoped

Config writes can affect OpenClaw runtime behavior. Real E2E may perform a
no-op apply of the fetched raw text with the current `baseHash`, or a
run-scoped reversible edit only when the test can prove it owns the isolated
state and can restore the original snapshot. If writable raw text is missing,
fixture creation is skipped-safe with evidence.

Alternative considered: always patch `openclaw.json` to add synthetic config
data. Rejected because the current real stack intentionally reuses OpenClaw user
state for live channel/model access, so writes must be bounded and reversible.

### D3: Prototype-only right-pane History remains accepted exception

The prototype includes a History tab backed by mock `recentApplies`, but there
is no Deck-facing audit/history endpoint. Production may show a local last
apply result, but it must not claim durable history until a separate contract
exists.

Alternative considered: synthesize a history list from local state. Rejected
because it would blur visual prototype data with real product capability.

### D4: Schema-driven form remains local state for now

The current schema lookup contract is per-path and lazy. A form library may be a
future engineering choice, but this child should preserve the existing local
state helpers unless verification finds a correctness bug.

Alternative considered: introduce `react-hook-form` during parity remediation.
Rejected because dependency and architecture selection is outside this child and
not required for prototype parity.

## Risks / Trade-offs

- **Risk: Real config may be read-only (`raw: null`).** -> Keep the UI read-only,
  attach fixture evidence, and classify write validation as handoff-blocked.
- **Risk: Mock visual state can overstate unsupported history/import features.**
  -> Use accepted exceptions and avoid presenting unsupported features as real
  capabilities.
- **Risk: The form is dense and locale-sensitive.** -> Capture theme/locale
  variants and inspect text overflow before declaring parity.
- **Risk: Direct config mutation could affect real OpenClaw behavior.** ->
  Restrict real writes to no-op or run-scoped reversible edits with cleanup
  guards.

## Migration Plan

1. Audit prototype files, production Config code, contract sources, BFF routes,
   mock visual spec, and real E2E spec.
2. Generate or inspect prototype-current parity evidence for the active v2
   Config target.
3. Patch deterministic UI, i18n, fixture, or test drift found by the audit.
4. Upgrade mock visual E2E to capture workbench, section/form, right-pane modes,
   sensitive reveal, apply confirmation, and localized theme variants.
5. Upgrade real E2E to verify route shapes, shell navigation, both theme/locale
   axes, safe child interactions, BFF-only transport, unexpected errors, and
   no-op/run-scoped fixture evidence or skipped-safe circuit breaker.
6. Update implementation notes and the head matrix, validate, then archive this
   child proposal.

## Open Questions

- Whether a future proposal should add durable config apply history.
- Whether a future proposal should add scaffold/create defaults, import/export,
  rollback, or schema batch lookup.
- Whether `hint.secret` / `format: "env-ref"` should become a shared contract
  hint across Config, Models, and Channels.
- Whether a form library should be adopted after product behavior stabilizes.

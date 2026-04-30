## ADDED Requirements

### Requirement: deck-go BFF re-implements 5 C3 light-view handlers

deck-go BFF SHALL provide BFF-side implementations for `deck.routing.list`, `deck.subagents.list`, `deck.subagents.lineage`, `deck.identity.list`, `deck.threads.list`. Each implementation SHALL produce output structurally byte-equal to the corresponding openclaw fork handler (when the latter is invoked with the same params against the same runtime state).

#### Scenario: BFF view returns same shape as upstream handler

- **WHEN** the BFF view `RoutingList` is called with `{}` and the upstream `deck.routing.list` is called with the same params against the same gateway state
- **THEN** the JSON-serialised result structures are byte-equal after key-sorted normalisation

#### Scenario: Capture-replay regression detects schema drift

- **WHEN** the test suite replays captured upstream handler responses against the BFF view implementation
- **THEN** any difference (added/removed/changed field) causes the test to fail with a path-by-path diff

### Requirement: Each C3 BFF view uses gateway.batch for fan-out

Each of the 5 BFF views SHALL compose its result by invoking 2-3 read-only gateway RPCs through the typed `gateway.batch` primitive in a single WebSocket frame, NOT through serial `RequestTyped` calls.

#### Scenario: RoutingList issues exactly one outbound batch frame

- **WHEN** `RoutingList` is invoked
- **THEN** the underlying `Realtime` records exactly 1 outbound `{method:"gateway.batch"}` frame, and 0 outbound frames for the individual sub-call methods

#### Scenario: BFF view fails fast when batch sub-call fails

- **WHEN** any sub-call inside the batch returns an error
- **THEN** the BFF view returns an error wrapping the failed sub-call's error envelope, with the BFF view's method name in the error context

### Requirement: Feature flag controls migration cutover

A feature flag (env `DECK_GO_BFF_VIEW_LAYER`) SHALL determine whether the BFF view or the upstream `deck.*.list` handler is invoked for each of the 5 methods. Flag default value is documented per release.

#### Scenario: Flag disabled routes through upstream handler

- **WHEN** `DECK_GO_BFF_VIEW_LAYER=` (empty/unset) and a request hits a chi route that maps to one of the 5 views
- **THEN** the BFF invokes the upstream `deck.routing.list` handler via the existing typed client and returns its response

#### Scenario: Flag enabled routes through BFF view

- **WHEN** `DECK_GO_BFF_VIEW_LAYER=1` and the same request is made
- **THEN** the BFF invokes its local view implementation, which uses `gateway.batch` for fan-out

### Requirement: Automatic fallback on BFF view error preserves user experience

When the flag is enabled but a BFF view raises an unrecoverable error, the system SHALL fall back to the upstream handler for that single request and SHALL emit an audit warning line tagged with view name and error, unless fallback is explicitly disabled for test/canary validation via `DECK_GO_BFF_VIEW_FALLBACK=0`.

#### Scenario: BFF view error triggers single-request fallback

- **WHEN** `DECK_GO_BFF_VIEW_LAYER=1` and the BFF view's `gateway.batch` call returns a transport-level error
- **THEN** the BFF retries via the upstream handler within the same request lifecycle, returns the upstream result, and writes a `view.fallback method=<name> reason=<msg>` audit warning line (rate-limited to 1 per minute per view)

#### Scenario: Fallback disabled exposes BFF view failure

- **WHEN** `DECK_GO_BFF_VIEW_LAYER=1` and `DECK_GO_BFF_VIEW_FALLBACK=0` and the BFF view's `gateway.batch` call returns a transport-level error
- **THEN** the request fails with the BFF view error and the upstream handler is NOT invoked

#### Scenario: Fallback rate metric exposes BFF view health

- **WHEN** observed over a 5-minute window
- **THEN** the BFF MUST expose a metric `deck_go_view_fallback_rate{view=<name>}` calculated as `fallback_count / view_invocation_count`; sustained rate > 5% for two consecutive 5-minute windows MUST trigger an alert or block default flag enablement

### Requirement: Performance baseline is captured per release

For each of the 5 BFF views, the project SHALL maintain `deck-go/docs/perf-baseline.md` containing P50/P95/P99 latency measurements for both BFF view and upstream fallback paths. Each baseline entry SHALL include environment metadata (OS, CPU, NO_PROXY state, gateway commit, deck-go commit).

#### Scenario: BFF view P95 ≤ 60% of upstream fallback P95

- **WHEN** a release captures baseline measurements for a BFF view
- **THEN** the BFF view's P95 SHALL be ≤ 60% of the upstream fallback's P95 for the same call (target: ≥ 40% latency reduction)

#### Scenario: PR introducing > 10% regression is blocked

- **WHEN** a PR's perf-baseline data shows any BFF view's P95 increasing by more than 10% relative to the previous baseline
- **THEN** the PR review SHOULD block merging until the regression is justified or fixed

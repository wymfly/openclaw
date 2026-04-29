# Deck Go Gateway Protocol Full Alignment Plan

**OpenSpec change:** `deck-go-gateway-protocol-full-alignment`

**Purpose:** This plan is the closure coverage map for the OpenSpec proposal. It records stable `covers.id` entries for every scenario in the change. The implementation remains split across the PR sequence in `openspec/changes/deck-go-gateway-protocol-full-alignment/tasks.md`; scenarios stay pending in `verification.yaml` until those PRs land and fresh evidence is recorded.

## Phase 0 Foundation

### Task: PR-1 generated typed client rename

**covers.id:** `deck-go-gateway-mvp-followup.typed-client-imports`
**covers.id:** `deck-go-gateway-mvp-followup.typed-client-codegen`

### Task: PR-2 backend CI guard

**covers.id:** `deck-go-gateway-mvp-followup.backend-ci-guard`
**covers.id:** `deck-go-gateway-mvp-followup.ci-go-env-parity`

### Task: PR-2.5 event codegen

**covers.id:** `deck-go-gateway-mvp-followup.events-go-ts-parity`
**covers.id:** `deck-go-gateway-mvp-followup.subscription-generated-events`

### Task: PR-3 RequestTyped transport path

**covers.id:** `deck-go-gateway-mvp-followup.requesttyped-direct-struct`
**covers.id:** `deck-go-gateway-mvp-followup.request-map-compatible`
**covers.id:** `deck-go-gateway-mvp-followup.client-realtime-interfaces`
**covers.id:** `deck-go-gateway-mvp-followup.requesttyped-roundtrip-shapes`

### Task: PR-4 typed error model

**covers.id:** `deck-go-gateway-error-scope-model.errcode-envelope`
**covers.id:** `deck-go-gateway-error-scope-model.scope-denied-sentinel`
**covers.id:** `deck-go-gateway-error-scope-model.connection-lost-distinct`
**covers.id:** `deck-go-gateway-error-scope-model.handler-owned-scope-response`
**covers.id:** `deck-go-gateway-error-scope-model.wrapper-error-message-compatible`
**covers.id:** `gateway-communication.go-scope-error`

### Task: PR-5 probe client lifecycle

**covers.id:** `deck-go-gateway-mvp-followup.probe-failure-evict`
**covers.id:** `deck-go-gateway-mvp-followup.probe-token-invalidate`
**covers.id:** `deck-go-gateway-mvp-followup.probe-shutdown-close`

## Phases 1 Through 3 Go Typed Coverage

### Task: PR-7 through PR-16 Go caller migration

**covers.id:** `deck-go-gateway-typed-client-coverage.missing-methods-generated`
**covers.id:** `deck-go-gateway-typed-client-coverage.wrapper-typed-thin-shell`
**covers.id:** `deck-go-gateway-typed-client-coverage.upstream-method-autogen`
**covers.id:** `deck-go-gateway-typed-client-coverage.no-default-runtime-validation`
**covers.id:** `deck-go-gateway-typed-client-coverage.wrapper-name-stable`
**covers.id:** `gateway-communication.go-typed-binding`

### Task: PR-14 typed subscription API

**covers.id:** `deck-go-gateway-subscription-api.subscribe-sessions-typed-channel`
**covers.id:** `deck-go-gateway-subscription-api.subscribe-messages-typed-channel`
**covers.id:** `deck-go-gateway-subscription-api.slow-caller-rpc-unblocked`
**covers.id:** `deck-go-gateway-subscription-api.ctx-cancel-fresh-unsubscribe`
**covers.id:** `deck-go-gateway-subscription-api.lifecycle-refcount-last-unsubscribe`
**covers.id:** `deck-go-gateway-subscription-api.explicit-cancel-equivalent`
**covers.id:** `deck-go-gateway-subscription-api.concurrent-subscriptions-independent-close`
**covers.id:** `deck-go-gateway-subscription-api.per-subscriber-backpressure`
**covers.id:** `deck-go-gateway-subscription-api.dispatch-overflow-metric`
**covers.id:** `deck-go-gateway-subscription-api.custom-buffer-size`
**covers.id:** `deck-go-gateway-subscription-api.reconnect-keeps-channel`
**covers.id:** `deck-go-gateway-subscription-api.resubscribe-transparent`
**covers.id:** `deck-go-gateway-subscription-api.goleak-tests`

## Phase 4 Frontend Typed Client

### Task: PR-17 endpoint classification and frontend typed client migration

**covers.id:** `deck-go-frontend-typed-client-adoption.typed-rpc-client`
**covers.id:** `deck-go-frontend-typed-client-adoption.bff-control-plane-fetch`
**covers.id:** `deck-go-frontend-typed-client-adoption.binary-sse-upload-fetch`
**covers.id:** `deck-go-frontend-typed-client-adoption.gateway-rpc-proxy-delete-only`
**covers.id:** `deck-go-frontend-typed-client-adoption.transport-auth-header`
**covers.id:** `deck-go-frontend-typed-client-adoption.transport-tracing`
**covers.id:** `deck-go-frontend-typed-client-adoption.fe-error-narrowing`
**covers.id:** `deck-go-gateway-error-scope-model.fe-gateway-error`
**covers.id:** `deck-go-gateway-error-scope-model.fe-scope-redirect`
**covers.id:** `gateway-communication.fe-typed-client`
**covers.id:** `gateway-communication.fe-error-union`

## Phase 4 Coverage Gate

### Task: PR-18 static gate and coverage report

**covers.id:** `deck-go-gateway-typed-client-coverage.untyped-go-call-blocked`
**covers.id:** `deck-go-gateway-typed-client-coverage.inline-exception`
**covers.id:** `deck-go-gateway-coverage-gate.untyped-call-blocks-ci`
**covers.id:** `deck-go-gateway-coverage-gate.inline-exception`
**covers.id:** `deck-go-gateway-coverage-gate.fe-classification-whitelist`
**covers.id:** `deck-go-gateway-coverage-gate.coverage-report-metrics`
**covers.id:** `deck-go-gateway-coverage-gate.coverage-regression-blocks`
**covers.id:** `deck-go-gateway-coverage-gate.coverage-regression-exception`
**covers.id:** `deck-go-gateway-coverage-gate.upstream-growth-not-regression`
**covers.id:** `deck-go-gateway-coverage-gate.fork-methods-excluded`

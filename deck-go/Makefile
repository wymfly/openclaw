SHELL := /bin/bash

GO_ENV := GOCACHE=/tmp/deck-go-buildcache GOMODCACHE=/tmp/deck-go-gomodcache GOPATH=/tmp/deck-go-gopath GOSUMDB=off
NPM_ENV := npm_config_cache=/tmp/deck-go-npm-cache
REPO_ROOT := $(abspath ..)

.PHONY: contracts-sync contracts-check deck-api-check contracts-codegen-test ui-metadata-sync ui-metadata-check ui-metadata-test endpoint-classification-sync endpoint-classification-check contract-exceptions-sync contract-exceptions-check stream-contract-sync stream-contract-check live-projection-contract-sync live-projection-contract-check live-projection-contract-test list-query-contract-sync list-query-contract-check list-query-contract-test mutation-evidence-contract-sync mutation-evidence-contract-check mutation-evidence-contract-test deck-api-dynamic-surfaces-sync deck-api-dynamic-surfaces-check route-governance-sync route-governance-check config-write-safety-sync config-write-safety-check gateway-describe-completeness-sync gateway-describe-completeness-check contract-inventory contract-chain-audit-sync contract-chain-audit-check contract-gate protocol-gen-ts protocol-gen-go protocol-update protocol-check protocol-check-missing-test protocol-check-drift-test fork-divergence-report gateway-typecheck gateway-coverage-report check-allowlist-parity benchmark-rpc host-check backend-test frontend-build verify real-e2e-seed smoke-stage3-host smoke-stage3-e2e smoke-stage3-rollback check-stage3-stabilization enforce-stage3-stabilization record-stage3-stabilization-incident stack-start stack-stop stack-restart stack-status stack-logs stack-backend-fg stack-frontend-fg stack-runtime-start stack-runtime-stop stack-chat-smoke

contracts-sync:
	node contracts/scripts/sync-deck-api-generated.mjs

deck-api-check:
	node contracts/scripts/check-deck-api-generated.mjs

contracts-check: deck-api-check ui-metadata-check

contracts-codegen-test:
	node contracts/scripts/deck-api-codegen.test.mjs

ui-metadata-sync:
	node contracts/scripts/sync-ui-contract-metadata.mjs

ui-metadata-check:
	CHECK_MODE=1 node contracts/scripts/sync-ui-contract-metadata.mjs

ui-metadata-test:
	node contracts/scripts/sync-ui-contract-metadata.test.mjs

endpoint-classification-sync:
	node contracts/scripts/sync-endpoint-classification.mjs

endpoint-classification-check:
	CHECK_MODE=1 node contracts/scripts/sync-endpoint-classification.mjs

contract-exceptions-sync:
	node contracts/scripts/sync-contract-exceptions.mjs

contract-exceptions-check:
	CHECK_MODE=1 node contracts/scripts/sync-contract-exceptions.mjs

stream-contract-sync:
	node contracts/scripts/sync-stream-contract.mjs

stream-contract-check:
	CHECK_MODE=1 node contracts/scripts/sync-stream-contract.mjs

live-projection-contract-sync:
	node contracts/scripts/sync-live-projection-contract.mjs

live-projection-contract-check:
	CHECK_MODE=1 node contracts/scripts/sync-live-projection-contract.mjs

live-projection-contract-test:
	node contracts/scripts/sync-live-projection-contract.test.mjs

list-query-contract-sync:
	node contracts/scripts/sync-list-query-contract.mjs

list-query-contract-check:
	CHECK_MODE=1 node contracts/scripts/sync-list-query-contract.mjs

list-query-contract-test:
	node contracts/scripts/sync-list-query-contract.test.mjs

mutation-evidence-contract-sync:
	node contracts/scripts/sync-mutation-evidence-contract.mjs

mutation-evidence-contract-check:
	CHECK_MODE=1 node contracts/scripts/sync-mutation-evidence-contract.mjs

mutation-evidence-contract-test:
	node contracts/scripts/sync-mutation-evidence-contract.test.mjs

deck-api-dynamic-surfaces-sync:
	node contracts/scripts/sync-deck-api-dynamic-surfaces.mjs

deck-api-dynamic-surfaces-check:
	CHECK_MODE=1 node contracts/scripts/sync-deck-api-dynamic-surfaces.mjs

route-governance-sync:
	node contracts/scripts/sync-route-governance.mjs

route-governance-check:
	CHECK_MODE=1 node contracts/scripts/sync-route-governance.mjs

config-write-safety-sync:
	node contracts/scripts/sync-config-write-safety.mjs

config-write-safety-check:
	CHECK_MODE=1 node contracts/scripts/sync-config-write-safety.mjs

gateway-describe-completeness-sync:
	cd "$(REPO_ROOT)" && pnpm exec tsx deck-go/contracts/scripts/gateway-describe-completeness.ts

gateway-describe-completeness-check:
	cd "$(REPO_ROOT)" && CHECK_MODE=1 pnpm exec tsx deck-go/contracts/scripts/gateway-describe-completeness.ts

contract-inventory:
	node contracts/scripts/deck-contract-inventory.mjs

contract-chain-audit-sync:
	node scripts/sync-contract-chain-audit.mjs

contract-chain-audit-check:
	CHECK_MODE=1 node scripts/sync-contract-chain-audit.mjs

contract-gate: contracts-codegen-test ui-metadata-test live-projection-contract-test list-query-contract-test mutation-evidence-contract-test contracts-check endpoint-classification-check contract-exceptions-check stream-contract-check live-projection-contract-check list-query-contract-check mutation-evidence-contract-check deck-api-dynamic-surfaces-check route-governance-check config-write-safety-check protocol-check gateway-typecheck gateway-describe-completeness-check contract-inventory contract-chain-audit-check

protocol-gen-ts:
	cd "$(REPO_ROOT)" && pnpm exec tsx deck-go/contracts/scripts/protocol-gen-ts.ts

protocol-gen-go:
	cd "$(REPO_ROOT)" && pnpm exec tsx deck-go/contracts/scripts/protocol-gen-go.ts

protocol-update: protocol-gen-ts protocol-gen-go

protocol-check:
	cd "$(REPO_ROOT)" && CHECK_MODE=1 pnpm exec tsx deck-go/contracts/scripts/protocol-gen-ts.ts
	cd "$(REPO_ROOT)" && CHECK_MODE=1 pnpm exec tsx deck-go/contracts/scripts/protocol-gen-go.ts

protocol-check-missing-test:
	@tmp=$$(mktemp); \
	target="backend/internal/gateway/generated/methods.go"; \
	cp "$$target" "$$tmp"; \
	trap 'cp "$$tmp" "$$target"; rm -f "$$tmp"' EXIT; \
	rm -f "$$target"; \
	if $(MAKE) protocol-check 2>&1 | grep -q '^MISSING:'; then exit 0; fi; \
	echo "protocol-check did not report MISSING for $$target" >&2; \
	exit 1

protocol-check-drift-test:
	@tmp=$$(mktemp); \
	target="backend/internal/gateway/generated/methods.go"; \
	cp "$$target" "$$tmp"; \
	trap 'cp "$$tmp" "$$target"; rm -f "$$tmp"' EXIT; \
	printf '\n// drift\n' >> "$$target"; \
	if $(MAKE) protocol-check 2>&1 | grep -q '^DRIFT:'; then exit 0; fi; \
	echo "protocol-check did not report DRIFT for $$target" >&2; \
	exit 1

fork-divergence-report:
	cd "$(REPO_ROOT)" && pnpm exec tsx deck-go/contracts/scripts/fork-divergence-report.ts

gateway-typecheck:
	cd "$(REPO_ROOT)" && pnpm exec tsx deck-go/contracts/scripts/gateway-typecheck.ts

gateway-coverage-report:
	cd "$(REPO_ROOT)" && pnpm exec tsx deck-go/contracts/scripts/gateway-coverage-report.ts

check-allowlist-parity:
	cd "$(REPO_ROOT)" && pnpm exec tsx deck-go/contracts/scripts/protocol-parity-check.ts

benchmark-rpc:
	cd backend && $(GO_ENV) go test -run 'Test(RealtimeRequest_P50Below10ms|RequestDirectBaseline_P50Recorded)' ./internal/gateway/...

backend-test:
	cd backend && $(GO_ENV) go test ./...

host-check:
	node scripts/check-active-host-paths.mjs

frontend-build:
	cd frontend-new && $(NPM_ENV) npm run build

verify: contracts-check host-check backend-test frontend-build

real-e2e-seed:
	DECK_GO_REAL_GATEWAY_E2E=1 pnpm exec playwright test --config playwright.config.ts test/e2e/real-gateway.spec.ts --grep "exercises the real Gateway control plane"

smoke-stage3-host:
	@echo "smoke-stage3-host is deprecated for Codex/Ralph validation; use the Codex Playwright plugin against a managed foreground stack." >&2
	@exit 2

smoke-stage3-e2e:
	@echo "smoke-stage3-e2e is deprecated for Codex/Ralph validation; use the Codex Playwright plugin against a managed foreground stack." >&2
	@exit 2

smoke-stage3-rollback:
	./scripts/smoke-stage3-rollback.sh

check-stage3-stabilization:
	node scripts/check-stage3-stabilization.mjs

enforce-stage3-stabilization:
	node scripts/check-stage3-stabilization.mjs --enforce

record-stage3-stabilization-incident:
	node scripts/record-stage3-stabilization-incident.mjs --date "$(DATE)" --severity "$(SEVERITY)" --summary "$(SUMMARY)" $(if $(ATTRIBUTION),--attribution "$(ATTRIBUTION)",) $(if $(STATUS),--status "$(STATUS)",)

stack-start:
	./scripts/manage-local-stack.sh start

stack-stop:
	./scripts/manage-local-stack.sh stop

stack-restart:
	./scripts/manage-local-stack.sh restart

stack-status:
	./scripts/manage-local-stack.sh status

stack-logs:
	./scripts/manage-local-stack.sh logs

stack-backend-fg:
	./scripts/manage-local-stack.sh backend-fg

stack-frontend-fg:
	./scripts/manage-local-stack.sh frontend-fg

stack-runtime-start:
	./scripts/manage-local-stack.sh runtime-start

stack-runtime-stop:
	./scripts/manage-local-stack.sh runtime-stop

stack-chat-smoke:
	@echo "stack-chat-smoke is deprecated for Codex/Ralph validation; use the Codex Playwright plugin against a managed foreground stack." >&2
	@exit 2

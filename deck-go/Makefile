SHELL := /bin/bash

GO_ENV := GOCACHE=/tmp/deck-go-buildcache GOSUMDB=off
NPM_ENV := npm_config_cache=/tmp/deck-go-npm-cache
REPO_ROOT := $(abspath ..)

.PHONY: contracts-sync contracts-check protocol-gen-ts protocol-gen-go protocol-update protocol-check protocol-check-missing-test protocol-check-drift-test fork-divergence-report gateway-typecheck gateway-coverage-report check-allowlist-parity benchmark-rpc host-check backend-test frontend-build verify smoke-stage3-host smoke-stage3-e2e smoke-stage3-rollback check-stage3-stabilization enforce-stage3-stabilization record-stage3-stabilization-incident stack-start stack-stop stack-restart stack-status stack-logs stack-backend-fg stack-frontend-fg stack-runtime-start stack-runtime-stop stack-chat-smoke

contracts-sync:
	node contracts/scripts/sync-deck-api-generated.mjs

contracts-check:
	node contracts/scripts/check-deck-api-generated.mjs

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
	cd frontend && $(NPM_ENV) npm run build

verify: contracts-check host-check backend-test frontend-build

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

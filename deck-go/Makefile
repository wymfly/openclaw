SHELL := /bin/bash

GO_ENV := GOCACHE=/tmp/deck-go-buildcache GOMODCACHE=/tmp/deck-go-modcache GOPATH=/tmp/deck-go-gopath GOSUMDB=off
NPM_ENV := npm_config_cache=/tmp/deck-go-npm-cache

.PHONY: contracts-sync contracts-check host-check backend-test frontend-build verify smoke-stage3-host smoke-stage3-e2e smoke-stage3-rollback check-stage3-stabilization enforce-stage3-stabilization record-stage3-stabilization-incident stack-start stack-stop stack-restart stack-status stack-logs stack-backend-fg stack-frontend-fg stack-runtime-start stack-runtime-stop stack-chat-smoke

contracts-sync:
	node contracts/scripts/sync-deck-api-generated.mjs

contracts-check:
	node contracts/scripts/check-deck-api-generated.mjs

backend-test:
	cd backend && $(GO_ENV) go test ./...

host-check:
	node scripts/check-active-host-paths.mjs

frontend-build:
	cd frontend && $(NPM_ENV) npm run build

verify: contracts-check host-check backend-test frontend-build

smoke-stage3-host: frontend-build
	./scripts/smoke-stage3-host.sh

smoke-stage3-e2e:
	./scripts/smoke-stage3-e2e.sh

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
	./scripts/manage-local-stack.sh chat-smoke

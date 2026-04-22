SHELL := /bin/bash

GO_ENV := GOCACHE=/tmp/deck-go-buildcache GOMODCACHE=/tmp/deck-go-modcache GOPATH=/tmp/deck-go-gopath GOSUMDB=off
NPM_ENV := npm_config_cache=/tmp/deck-go-npm-cache

.PHONY: contracts-sync contracts-check host-check backend-test frontend-build verify

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

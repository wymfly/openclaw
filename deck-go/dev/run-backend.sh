#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

export DECK_GO_DATA_DIR="${DECK_GO_DATA_DIR:-/tmp/deck-go-data}"
export GOCACHE="${GOCACHE:-/tmp/deck-go-buildcache}"
export GOMODCACHE="${GOMODCACHE:-/tmp/deck-go-modcache}"
export GOPATH="${GOPATH:-/tmp/deck-go-gopath}"
export GOSUMDB="${GOSUMDB:-off}"

cd "$ROOT/backend"
go run ./cmd/deck-go


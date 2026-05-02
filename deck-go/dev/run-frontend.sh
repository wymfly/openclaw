#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

export npm_config_cache="${npm_config_cache:-/tmp/deck-go-npm-cache}"
cd "$ROOT/frontend-new"
npm run dev

#!/usr/bin/env bash
#
# run-stack-mock.sh — explicit mock Gateway operator stack wrapper.
#
# This wrapper exists so local debugging commands can say "mock" or "real"
# explicitly. It delegates to manage-local-stack.sh, whose built-in bundled
# defaults start test/fixtures/mock-gateway.mjs.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DECK_GO_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

if [[ -n "${DECK_GO_MOCK_STACK_ENV:-}" ]]; then
  export DECK_GO_STACK_ENV="${DECK_GO_MOCK_STACK_ENV}"
else
  export DECK_GO_STACK_ENV="${DECK_GO_STACK_ENV:-${DECK_GO_DIR}/.env}"
fi

exec "${DECK_GO_DIR}/scripts/manage-local-stack.sh" "$@"

#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

violations="$(
  rg -n 'gateway run' \
    test/e2e/*-real-gateway.spec.ts \
    test/e2e/real-gateway.spec.ts \
    test/e2e/helpers.ts \
    test/e2e/helpers/real-gateway-lifecycle.ts || true
)"

if [[ -n "$violations" ]]; then
  echo "$violations" >&2
  echo "Rule R3 violation: real Gateway E2E must use gateway install/start, not direct gateway run." >&2
  exit 1
fi

echo "R3 guard passed"
